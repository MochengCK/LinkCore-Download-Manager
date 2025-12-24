import json
import re
import sys
import urllib.parse
import urllib.request
import os

CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'


def _sanitize_filename(name):
  s = str(name or '').strip()
  if not s:
    return 'bilibili'
  s = re.sub(r'[\r\n\t]', ' ', s)
  s = re.sub(r'[<>:"/\\\\|?*]+', '_', s)
  s = re.sub(r'\s{2,}', ' ', s)
  s = s.strip(' .')
  return s or 'bilibili'


def _http_get_json(url, headers=None, timeout=15):
  req = urllib.request.Request(url, headers=headers or {})
  with urllib.request.urlopen(req, timeout=timeout) as resp:
    raw = resp.read()
  return json.loads(raw.decode('utf-8', errors='replace'))


def _resolve_redirect(url, timeout=15):
  req = urllib.request.Request(url, headers={'User-Agent': CHROME_UA})
  opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler)
  with opener.open(req, timeout=timeout) as resp:
    return resp.geturl()


def _extract_ids(url):
  s = str(url or '')
  bvid = None
  aid = None

  m_bv = re.search(r'(BV[0-9A-Za-z]+)', s)
  if m_bv:
    bvid = m_bv.group(1)

  m_av = re.search(r'(?:/video/)?av(\d+)', s, re.IGNORECASE)
  if m_av:
    aid = m_av.group(1)

  return bvid, aid


def _build_referer(bvid=None, aid=None):
  if bvid:
    return f'https://www.bilibili.com/video/{bvid}/'
  if aid:
    return f'https://www.bilibili.com/video/av{aid}/'
  return 'https://www.bilibili.com/'


def _get_view_info(bvid=None, aid=None, cookie=None):
  if bvid:
    u = f'https://api.bilibili.com/x/web-interface/view?bvid={urllib.parse.quote(bvid)}'
  elif aid:
    u = f'https://api.bilibili.com/x/web-interface/view?aid={urllib.parse.quote(str(aid))}'
  else:
    raise ValueError('missing video id')
  headers = {'User-Agent': CHROME_UA, 'Referer': 'https://www.bilibili.com/'}
  if cookie:
    headers['Cookie'] = cookie
  return _http_get_json(u, headers=headers)


def _get_playurl(bvid=None, aid=None, cid=None, qn=None, cookie=None, fnval=None):
  if not cid:
    raise ValueError('missing cid')
  base = 'https://api.bilibili.com/x/player/playurl'
  effective_qn = str(qn) if qn is not None and str(qn).strip() else '0'
  # Use fnval=4048 to enable DASH format (supports higher quality)
  # 1: FLV format, 16: DASH format, 64: 4K format, 128: Dolby Audio
  # 256: HDR format, 512: 8K format, 1024: AV1 format
  # 4048 = 16 + 64 + 128 + 256 + 512 + 1024 + 2048 (all formats)
  effective_fnval = str(fnval) if fnval is not None else '4048'
  # Changed platform to pc to get full quality list
  qs = {'cid': str(cid), 'qn': effective_qn, 'fnval': effective_fnval, 'fourk': '1', 'platform': 'pc'}
  if bvid:
    qs['bvid'] = bvid
  elif aid:
    qs['aid'] = str(aid)
  else:
    raise ValueError('missing video id')
  u = base + '?' + urllib.parse.urlencode(qs)
  headers = {'User-Agent': CHROME_UA, 'Referer': 'https://www.bilibili.com/'}
  if cookie:
    headers['Cookie'] = cookie
  return _http_get_json(u, headers=headers)


def _format_duration(seconds):
  try:
    s = int(seconds)
  except Exception:
    return None
  if s < 0:
    s = 0
  h = s // 3600
  m = (s % 3600) // 60
  sec = s % 60
  if h > 0:
    return f'{h:d}:{m:02d}:{sec:02d}'
  return f'{m:d}:{sec:02d}'


def _extract_dash_resources(dash, qn, title, referer):
  resources = []
  total_size = 0
  
  video_list = dash.get('video') or []
  audio_list = dash.get('audio') or []
  
  target_qn = 0
  if qn and str(qn).strip():
    try:
      target_qn = int(qn)
    except:
      pass
      
  # Select Video
  selected_video = None
  if target_qn > 0:
    # Try to find exact match first
    candidates = [v for v in video_list if int(v.get('id', 0)) == target_qn]
    if candidates:
      # Sort by bandwidth (higher bandwidth usually means better quality)
      candidates.sort(key=lambda x: int(x.get('bandwidth', 0)), reverse=True)
      selected_video = candidates[0]
    else:
      # If exact match not found, try to find closest higher quality first
      higher_qualities = [v for v in video_list if int(v.get('id', 0)) >= target_qn]
      if higher_qualities:
        # Sort by quality ID first, then bandwidth
        higher_qualities.sort(key=lambda x: (int(x.get('id', 0)), int(x.get('bandwidth', 0))), reverse=True)
        selected_video = higher_qualities[0]
      else:
        # If no higher quality available, find closest lower quality
        lower_qualities = [v for v in video_list if int(v.get('id', 0)) <= target_qn]
        if lower_qualities:
          lower_qualities.sort(key=lambda x: (int(x.get('id', 0)), int(x.get('bandwidth', 0))), reverse=True)
          selected_video = lower_qualities[0]
      
  if not selected_video and video_list:
    # Fallback to highest available quality
    video_list.sort(key=lambda x: (int(x.get('id', 0)), int(x.get('bandwidth', 0))), reverse=True)
    selected_video = video_list[0]
    
  # Select Audio
  selected_audio = None
  if audio_list:
    audio_list.sort(key=lambda x: int(x.get('bandwidth', 0)), reverse=True)
    selected_audio = audio_list[0]
    
  if selected_video:
    base_url = selected_video.get('baseUrl') or selected_video.get('base_url')
    if base_url:
      size = 0
      # Try to get size from bandwidth/duration if not explicit? 
      # Usually DASH doesn't give explicit file size in the manifest easily without segment calculation,
      # but Bilibili often puts it in 'size' field? No, DASH standard doesn't require it.
      # But sometimes Bilibili API returns it?
      # Actually, let's check keys.
      # Assuming 'bandwidth' * 'duration' / 8 approx?
      # Or maybe just 0.
      
      # Use codecid to guess extension?
      codecid = selected_video.get('codecid')
      # 7=AVC, 12=HEVC, 13=AV1?
      ext = '.mp4'
      
      resources.append({
        'url': base_url,
        'name': f"{title}_video.mp4",
        'referer': referer,
        'user_agent': CHROME_UA,
        'size': 0 
      })

  if selected_audio:
    base_url = selected_audio.get('baseUrl') or selected_audio.get('base_url')
    if base_url:
      resources.append({
        'url': base_url,
        'name': f"{title}_audio.m4a",
        'referer': referer,
        'user_agent': CHROME_UA,
        'size': 0
      })
      
  return resources, total_size


def parse_bilibili(url, qn=None, cookie=None):
  final_url = _resolve_redirect(url)
  bvid, aid = _extract_ids(final_url)
  if not bvid and not aid:
    raise ValueError('unsupported url')

  view = _get_view_info(bvid=bvid, aid=aid, cookie=cookie)
  view_code = (view or {}).get('code')
  view_message = (view or {}).get('message')
  data = (view or {}).get('data') or {}
  title = _sanitize_filename(data.get('title') or '')
  pages = data.get('pages') or []
  if not pages:
    raise ValueError('no pages')
  cid = pages[0].get('cid')
  if not cid:
    raise ValueError('missing cid')

  support_formats = data.get('support_formats') or []
  support_qualities = {}
  for fmt in support_formats:
    try:
      qn_int = int(fmt.get('quality'))
    except Exception:
      continue
    desc = fmt.get('new_description') or fmt.get('description') or None
    if desc is not None:
      desc = str(desc).strip() or None
    support_qualities[qn_int] = desc

  if not bvid:
    bvid = data.get('bvid') or bvid
  if not aid:
    aid = data.get('aid') or aid

  referer = _build_referer(bvid=bvid, aid=aid)
  play = _get_playurl(bvid=bvid, aid=aid, cid=cid, qn=qn, cookie=cookie)
  play_code = (play or {}).get('code')
  play_message = (play or {}).get('message')
  p_data = (play or {}).get('data') or {}
  if play_code is not None and str(play_code) != '0':
    raise ValueError(str(play_message or play_code))

  accept_quality = p_data.get('accept_quality') or []
  accept_desc = p_data.get('accept_description') or []
  
  # If no qualities returned but support_formats has data, use support_formats
  if not accept_quality and support_formats:
    accept_quality = [fmt.get('quality') for fmt in support_formats if fmt.get('quality')]
    accept_desc = [fmt.get('new_description') or fmt.get('description') for fmt in support_formats]
  
  qualities = []
  seen_qn = set()
  for idx, q in enumerate(accept_quality):
    try:
      qn_int = int(q)
    except Exception:
      continue
    if qn_int in seen_qn:
      continue
    seen_qn.add(qn_int)
    desc = None
    if idx < len(accept_desc):
      desc = str(accept_desc[idx] or '').strip() or None
    if qn_int in support_qualities and not desc:
      desc = support_qualities[qn_int]
    if qn_int not in support_qualities and desc:
      support_qualities[qn_int] = desc
    qualities.append({'qn': qn_int, 'desc': desc})

  # If still no qualities, try to get from support_qualities
  if not qualities and support_qualities:
    for qn_int, desc in support_qualities.items():
      qualities.append({'qn': qn_int, 'desc': desc})

  qualities.sort(key=lambda item: item.get('qn') or 0, reverse=True)

  durl = p_data.get('durl') or []
  dash = p_data.get('dash')
  
  if (not durl) and (not dash) and accept_quality and (qn is None or (not str(qn).strip()) or str(qn).strip() == '0'):
    play = _get_playurl(bvid=bvid, aid=aid, cid=cid, qn=accept_quality[0], cookie=cookie)
    p_data = (play or {}).get('data') or {}
    durl = p_data.get('durl') or []
    dash = p_data.get('dash')

  available_dash_ids = []
  if isinstance(dash, dict):
    video_list = dash.get('video') or []
    for v in video_list:
      try:
        vid = int(v.get('id', 0))
      except Exception:
        continue
      if vid > 0:
        available_dash_ids.append(vid)
    if available_dash_ids:
      available_dash_ids = sorted(set(available_dash_ids), reverse=True)

  requested_qn_int = None
  if qn is not None and str(qn).strip():
    try:
      requested_qn_int = int(str(qn).strip())
    except Exception:
      requested_qn_int = None

  selected_qn_int = None
  if available_dash_ids:
    if requested_qn_int is not None:
      if requested_qn_int in available_dash_ids:
        selected_qn_int = requested_qn_int
      else:
        # Try to find closest higher quality first
        higher = [x for x in available_dash_ids if x >= requested_qn_int]
        if higher:
          selected_qn_int = higher[0]
        else:
          # If no higher quality available, find closest lower quality
          lower = [x for x in available_dash_ids if x <= requested_qn_int]
          if lower:
            selected_qn_int = lower[0]
          else:
            selected_qn_int = available_dash_ids[0]
    else:
      selected_qn_int = available_dash_ids[0]

  resources = []
  total_size = 0

  if dash:
    effective_qn_for_dash = selected_qn_int if selected_qn_int is not None else requested_qn_int
    resources, total_size = _extract_dash_resources(dash, effective_qn_for_dash, title, referer)
  elif durl:
    for idx, item in enumerate(durl):
      u = item.get('url')
      if not u:
        continue
      path = urllib.parse.urlparse(u).path or ''
      ext = ''
      m_ext = re.search(r'\.([A-Za-z0-9]{1,6})$', path)
      if m_ext:
        ext = '.' + m_ext.group(1)
      else:
        ext = '.mp4'
      name = title + ext if len(durl) == 1 else f'{title}.part{idx + 1}{ext}'
      size = item.get('size')
      try:
        size_int = int(size) if size is not None else 0
      except Exception:
        size_int = 0
      if size_int > 0:
        total_size += size_int
      resources.append({
        'url': u,
        'name': name,
        'referer': referer,
        'user_agent': CHROME_UA,
        'size': size_int
      })
  
  if not resources:
    # If no resources found but we have qualities, maybe try to fetch durl for the first quality?
    # But usually one of the above should work.
    # If forced DASH but no dash, and no durl...
    raise ValueError('no playurl')

  owner_name = None
  owner = data.get('owner') or {}
  if isinstance(owner, dict):
    v = owner.get('name')
    if v:
      owner_name = str(v)
  duration = data.get('duration')

  debug_support = []
  for qn_int, desc in support_qualities.items():
    debug_support.append({'qn': qn_int, 'desc': desc})
  debug_support.sort(key=lambda item: item.get('qn') or 0, reverse=True)

  return {
    'ok': True,
    'title': title,
    'owner': owner_name,
    'duration': duration,
    'duration_text': _format_duration(duration),
    'total_size': total_size if total_size > 0 else None,
    'qualities': qualities,
    'bvid': bvid,
    'aid': aid,
    'referer': referer,
    'resources': resources,
    'debug': {
      'requested_qn': requested_qn_int,
      'selected_qn': selected_qn_int,
      'dash_video_ids': available_dash_ids,
      'final_url': final_url,
      'has_cookie': True if cookie else False,
      'has_sessdata': True if (cookie and ('SESSDATA=' in cookie)) else False,
      'view_code': view_code,
      'view_message': view_message,
      'play_code': play_code,
      'play_message': play_message,
      'support_qualities': debug_support,
      'accept_quality': accept_quality,
      'accept_description': accept_desc
    }
  }


def main(argv):
  if len(argv) < 2:
    sys.stderr.write('missing url\n')
    return 2
  url = argv[1]
  qn = None
  cookie = os.environ.get('BILI_COOKIE') or None
  i = 2
  while i < len(argv):
    a = argv[i]
    if a == '--qn' and i + 1 < len(argv):
      qn = argv[i + 1]
      i += 2
      continue
    if a == '--cookie' and i + 1 < len(argv):
      cookie = argv[i + 1]
      i += 2
      continue
    i += 1
  result = parse_bilibili(url, qn=qn, cookie=cookie)
  data = json.dumps(result, ensure_ascii=False)
  out = getattr(sys.stdout, 'buffer', None)
  if out is not None:
    out.write(data.encode('utf-8', errors='replace'))
  else:
    sys.stdout.write(data)
  return 0


if __name__ == '__main__':
  try:
    code = main(sys.argv)
  except Exception as e:
    data = json.dumps({'ok': False, 'error': str(e)}, ensure_ascii=False)
    out = getattr(sys.stdout, 'buffer', None)
    if out is not None:
      out.write(data.encode('utf-8', errors='replace'))
    else:
      sys.stdout.write(data)
    code = 1
  sys.exit(code)
