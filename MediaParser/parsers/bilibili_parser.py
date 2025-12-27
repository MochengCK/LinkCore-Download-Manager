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
  epid = None
  ssid = None
  media_id = None

  m_bv = re.search(r'(BV[0-9A-Za-z]+)', s)
  if m_bv:
    bvid = m_bv.group(1)

  m_av = re.search(r'(?:/video/)?av(\d+)', s, re.IGNORECASE)
  if m_av:
    aid = m_av.group(1)

  m_ep = re.search(r'/bangumi/play/ep(\d+)', s, re.IGNORECASE)
  if m_ep:
    epid = m_ep.group(1)

  m_ss = re.search(r'/bangumi/play/ss(\d+)', s, re.IGNORECASE)
  if m_ss:
    ssid = m_ss.group(1)

  m_media = re.search(r'/media/md(\d+)', s, re.IGNORECASE)
  if m_media:
    media_id = m_media.group(1)

  return bvid, aid, epid, ssid, media_id


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
  effective_fnval = str(fnval) if fnval is not None else '4048'
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


def _get_bangumi_info(epid=None, ssid=None, cookie=None):
  if epid:
    u = f'https://api.bilibili.com/pgc/view/web/season?ep_id={urllib.parse.quote(str(epid))}'
  elif ssid:
    u = f'https://api.bilibili.com/pgc/view/web/season?season_id={urllib.parse.quote(str(ssid))}'
  else:
    raise ValueError('missing epid or ssid')
  headers = {'User-Agent': CHROME_UA, 'Referer': 'https://www.bilibili.com/'}
  if cookie:
    headers['Cookie'] = cookie
  return _http_get_json(u, headers=headers)


def _get_bangumi_playurl(epid, cid, qn=None, cookie=None, fnval=None):
  base = 'https://api.bilibili.com/pgc/player/web/playurl'
  effective_qn = str(qn) if qn is not None and str(qn).strip() else '0'
  effective_fnval = str(fnval) if fnval is not None else '4048'
  qs = {'ep_id': str(epid), 'cid': str(cid), 'qn': effective_qn, 'fnval': effective_fnval, 'fourk': '1'}
  u = base + '?' + urllib.parse.urlencode(qs)
  headers = {'User-Agent': CHROME_UA, 'Referer': 'https://www.bilibili.com/'}
  if cookie:
    headers['Cookie'] = cookie
  return _http_get_json(u, headers=headers)


def _get_media_collection_info(media_id, cookie=None):
  u = f'https://api.bilibili.com/x/medialist/info?media_id={urllib.parse.quote(str(media_id))}'
  headers = {'User-Agent': CHROME_UA, 'Referer': 'https://www.bilibili.com/'}
  if cookie:
    headers['Cookie'] = cookie
  return _http_get_json(u, headers=headers)


def _get_ugc_season_info(season_id, cookie=None):
  u = f'https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=0&season_id={urllib.parse.quote(str(season_id))}&sort_reverse=false&page_num=1&page_size=100'
  headers = {'User-Agent': CHROME_UA, 'Referer': 'https://www.bilibili.com/'}
  if cookie:
    headers['Cookie'] = cookie
  return _http_get_json(u, headers=headers)


def _get_video_collection_info(bvid=None, aid=None, cookie=None):
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


def parse_bilibili(url, qn=None, cookie=None, force_single=False):
  final_url = _resolve_redirect(url)
  bvid, aid, epid, ssid, media_id = _extract_ids(final_url)
  
  is_bangumi = epid or ssid
  is_collection = media_id
  
  if is_collection and not force_single:
    return _parse_media_collection(final_url, media_id, qn, cookie)
  
  if is_bangumi:
    return _parse_bangumi(final_url, epid, ssid, qn, cookie)
  
  if not bvid and not aid:
    raise ValueError('unsupported url')

  view = _get_view_info(bvid=bvid, aid=aid, cookie=cookie)
  view_code = (view or {}).get('code')
  view_message = (view or {}).get('message')
  data = (view or {}).get('data') or {}
  
  if view_code is not None and str(view_code) != '0':
    raise ValueError(str(view_message or view_code))
  
  ubs = data.get('ubs')
  if ubs and not force_single:
    try:
      return _parse_video_collection(final_url, bvid, aid, qn, cookie)
    except ValueError as e:
      if 'video not in collection' in str(e):
        pass
      else:
        raise
  
  ugc_season = data.get('ugc_season')
  if ugc_season and not force_single:
    try:
      return _parse_ugc_season(final_url, bvid, aid, qn, cookie)
    except ValueError as e:
      if 'video not in ugc season' in str(e):
        pass
      else:
        raise
  
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
        higher = [x for x in available_dash_ids if x >= requested_qn_int]
        if higher:
          selected_qn_int = higher[0]
        else:
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


def _parse_bangumi(final_url, epid, ssid, qn, cookie):
  bangumi = _get_bangumi_info(epid=epid, ssid=ssid, cookie=cookie)
  bangumi_code = (bangumi or {}).get('code')
  bangumi_message = (bangumi or {}).get('message')
  b_data = (bangumi or {}).get('data') or {}
  
  if bangumi_code is not None and str(bangumi_code) != '0':
    raise ValueError(str(bangumi_message or bangumi_code))
  
  season_title = _sanitize_filename(b_data.get('title') or '')
  episodes = b_data.get('episodes') or []
  
  if not episodes:
    raise ValueError('no episodes')
  
  target_episode = None
  if epid:
    target_episode = next((ep for ep in episodes if str(ep.get('id')) == str(epid)), None)
  else:
    target_episode = episodes[0] if episodes else None
  
  if not target_episode:
    raise ValueError('episode not found')
  
  episode_title = _sanitize_filename(target_episode.get('title') or target_episode.get('long_title') or '')
  cid = target_episode.get('cid')
  bvid = target_episode.get('bvid')
  aid = target_episode.get('aid')
  epid_final = target_episode.get('id')
  
  if not cid:
    raise ValueError('missing cid')
  
  referer = f'https://www.bilibili.com/bangumi/play/ep{epid_final}/'
  
  play = _get_bangumi_playurl(epid_final, cid, qn=qn, cookie=cookie)
  play_code = (play or {}).get('code')
  play_message = (play or {}).get('message')
  p_data = (play or {}).get('data') or {}
  
  if play_code is not None and str(play_code) != '0':
    raise ValueError(str(play_message or play_code))
  
  accept_quality = p_data.get('accept_quality') or []
  accept_desc = p_data.get('accept_description') or []
  
  qualities = []
  for idx, q in enumerate(accept_quality):
    try:
      qn_int = int(q)
    except Exception:
      continue
    desc = None
    if idx < len(accept_desc):
      desc = str(accept_desc[idx] or '').strip() or None
    qualities.append({'qn': qn_int, 'desc': desc})
  
  qualities.sort(key=lambda item: item.get('qn') or 0, reverse=True)
  
  durl = p_data.get('durl') or []
  dash = p_data.get('dash')
  
  if (not durl) and (not dash) and accept_quality and (qn is None or (not str(qn).strip()) or str(qn).strip() == '0'):
    play = _get_bangumi_playurl(epid_final, cid, qn=accept_quality[0], cookie=cookie)
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
        higher = [x for x in available_dash_ids if x >= requested_qn_int]
        if higher:
          selected_qn_int = higher[0]
        else:
          lower = [x for x in available_dash_ids if x <= requested_qn_int]
          if lower:
            selected_qn_int = lower[0]
          else:
            selected_qn_int = available_dash_ids[0]
    else:
      selected_qn_int = available_dash_ids[0]
  
  resources = []
  total_size = 0
  
  title = f"{season_title}_{episode_title}" if season_title and episode_title else (season_title or episode_title or 'bangumi')
  
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
    raise ValueError('no playurl')
  
  owner_name = None
  publisher = b_data.get('publisher') or {}
  if isinstance(publisher, dict):
    v = publisher.get('name')
    if v:
      owner_name = str(v)
  duration = target_episode.get('duration')
  
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
    'epid': epid_final,
    'ssid': ssid,
    'referer': referer,
    'resources': resources,
    'debug': {
      'requested_qn': requested_qn_int,
      'selected_qn': selected_qn_int,
      'dash_video_ids': available_dash_ids,
      'final_url': final_url,
      'has_cookie': True if cookie else False,
      'has_sessdata': True if (cookie and ('SESSDATA=' in cookie)) else False,
      'bangumi_code': bangumi_code,
      'bangumi_message': bangumi_message,
      'play_code': play_code,
      'play_message': play_message,
      'accept_quality': accept_quality,
      'accept_description': accept_desc,
      'season_title': season_title,
      'episode_title': episode_title
    }
  }


def _get_video_quality_info(bvid=None, aid=None, cookie=None):
  view = _get_view_info(bvid=bvid, aid=aid, cookie=cookie)
  view_code = (view or {}).get('code')
  view_message = (view or {}).get('message')
  data = (view or {}).get('data') or {}
  
  if view_code is not None and str(view_code) != '0':
    raise ValueError(str(view_message or view_code))
  
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

  play = _get_playurl(bvid=bvid, aid=aid, cid=cid, qn=None, cookie=cookie)
  play_code = (play or {}).get('code')
  play_message = (play or {}).get('message')
  p_data = (play or {}).get('data') or {}
  if play_code is not None and str(play_code) != '0':
    raise ValueError(str(play_message or play_code))

  accept_quality = p_data.get('accept_quality') or []
  accept_desc = p_data.get('accept_description') or []
  
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

  if not qualities and support_qualities:
    for qn_int, desc in support_qualities.items():
      qualities.append({'qn': qn_int, 'desc': desc})

  qualities.sort(key=lambda item: item.get('qn') or 0, reverse=True)
  
  return {'qualities': qualities}


def _parse_video_collection(final_url, bvid, aid, qn, cookie):
  view = _get_view_info(bvid=bvid, aid=aid, cookie=cookie)
  view_code = (view or {}).get('code')
  view_message = (view or {}).get('message')
  data = (view or {}).get('data') or {}
  
  if view_code is not None and str(view_code) != '0':
    raise ValueError(str(view_message or view_code))
  
  title = _sanitize_filename(data.get('title') or '')
  owner_name = None
  owner = data.get('owner') or {}
  if isinstance(owner, dict):
    v = owner.get('name')
    if v:
      owner_name = str(v)
  
  if not bvid:
    bvid = data.get('bvid') or bvid
  if not aid:
    aid = data.get('aid') or aid
  
  ubs = data.get('ubs')
  if not ubs:
    raise ValueError('video not in collection')
  
  media_id = ubs.get('media_id')
  if not media_id:
    raise ValueError('video not in collection')
  
  collection = _get_media_collection_info(media_id, cookie=cookie)
  collection_code = (collection or {}).get('code')
  collection_message = (collection or {}).get('message')
  c_data = (collection or {}).get('data') or {}
  
  if collection_code is not None and str(collection_code) != '0':
    raise ValueError(str(collection_message or collection_code))
  
  collection_title = _sanitize_filename(c_data.get('title') or '')
  collection_desc = c_data.get('intro') or ''
  upper = c_data.get('upper') or {}
  collection_owner_name = None
  if isinstance(upper, dict):
    v = upper.get('name')
    if v:
      collection_owner_name = str(v)
  
  media_list = c_data.get('media_list') or []
  
  if not media_list:
    raise ValueError('no media in collection')
  
  videos = []
  original_video_index = None
  original_video_bvid_for_quality = None
  original_video_aid_for_quality = None
  for idx, media in enumerate(media_list):
    vid_bvid = media.get('bvid')
    vid_aid = media.get('id')
    vid_title = _sanitize_filename(media.get('title') or f'video_{idx + 1}')
    duration = media.get('duration')
    page = media.get('page')
    
    if not vid_bvid and not vid_aid:
      continue
    
    if vid_bvid == bvid or str(vid_aid) == str(aid):
      original_video_index = idx + 1
      original_video_bvid_for_quality = vid_bvid
      original_video_aid_for_quality = vid_aid
    
    videos.append({
      'bvid': vid_bvid,
      'aid': vid_aid,
      'title': vid_title,
      'duration': duration,
      'duration_text': _format_duration(duration),
      'page': page,
      'index': idx + 1
    })
  
  if not videos:
    raise ValueError('no valid videos in collection')
  
  qualities = []
  if original_video_bvid_for_quality or original_video_aid_for_quality:
    try:
      quality_info = _get_video_quality_info(bvid=original_video_bvid_for_quality, aid=original_video_aid_for_quality, cookie=cookie)
      qualities = quality_info.get('qualities', [])
    except Exception:
      pass
  
  return {
    'ok': True,
    'type': 'collection',
    'title': collection_title,
    'description': collection_desc,
    'owner': collection_owner_name or owner_name,
    'media_id': media_id,
    'total_videos': len(videos),
    'videos': videos,
    'original_video_index': original_video_index,
    'qualities': qualities,
    'final_url': final_url,
    'debug': {
      'has_cookie': True if cookie else False,
      'has_sessdata': True if (cookie and ('SESSDATA=' in cookie)) else False,
      'collection_code': collection_code,
      'collection_message': collection_message,
      'original_video_title': title,
      'original_video_bvid': bvid,
      'original_video_aid': aid
    }
  }


def _parse_ugc_season(final_url, bvid, aid, qn, cookie):
  view = _get_view_info(bvid=bvid, aid=aid, cookie=cookie)
  view_code = (view or {}).get('code')
  view_message = (view or {}).get('message')
  data = (view or {}).get('data') or {}
  
  if view_code is not None and str(view_code) != '0':
    raise ValueError(str(view_message or view_code))
  
  title = _sanitize_filename(data.get('title') or '')
  owner_name = None
  owner = data.get('owner') or {}
  if isinstance(owner, dict):
    v = owner.get('name')
    if v:
      owner_name = str(v)
  
  if not bvid:
    bvid = data.get('bvid') or bvid
  if not aid:
    aid = data.get('aid') or aid
  
  ugc_season = data.get('ugc_season')
  if not ugc_season:
    raise ValueError('video not in ugc season')
  
  season_id = ugc_season.get('id')
  if not season_id:
    raise ValueError('video not in ugc season')
  
  season_title = _sanitize_filename(ugc_season.get('title') or '')
  season_desc = ugc_season.get('intro') or ''
  
  season_info = _get_ugc_season_info(season_id, cookie=cookie)
  season_code = (season_info or {}).get('code')
  season_message = (season_info or {}).get('message')
  s_data = (season_info or {}).get('data') or {}
  
  if season_code is not None and str(season_code) != '0':
    raise ValueError(str(season_message or season_code))
  
  archives = s_data.get('archives') or []
  
  if not archives:
    raise ValueError('no videos in season')
  
  videos = []
  original_video_index = None
  original_video_bvid_for_quality = None
  original_video_aid_for_quality = None
  for idx, archive in enumerate(archives):
    vid_bvid = archive.get('bvid')
    vid_aid = archive.get('aid')
    vid_title = _sanitize_filename(archive.get('title') or f'video_{idx + 1}')
    duration = archive.get('duration')
    
    if not vid_bvid and not vid_aid:
      continue
    
    if vid_bvid == bvid or str(vid_aid) == str(aid):
      original_video_index = idx + 1
      original_video_bvid_for_quality = vid_bvid
      original_video_aid_for_quality = vid_aid
    
    videos.append({
      'bvid': vid_bvid,
      'aid': vid_aid,
      'title': vid_title,
      'duration': duration,
      'duration_text': _format_duration(duration),
      'index': idx + 1
    })
  
  if not videos:
    raise ValueError('no valid videos in season')
  
  qualities = []
  if original_video_bvid_for_quality or original_video_aid_for_quality:
    try:
      quality_info = _get_video_quality_info(bvid=original_video_bvid_for_quality, aid=original_video_aid_for_quality, cookie=cookie)
      qualities = quality_info.get('qualities', [])
    except Exception:
      pass
  
  return {
    'ok': True,
    'type': 'collection',
    'title': season_title,
    'description': season_desc,
    'owner': owner_name,
    'season_id': season_id,
    'total_videos': len(videos),
    'videos': videos,
    'original_video_index': original_video_index,
    'qualities': qualities,
    'final_url': final_url,
    'debug': {
      'has_cookie': True if cookie else False,
      'has_sessdata': True if (cookie and ('SESSDATA=' in cookie)) else False,
      'season_code': season_code,
      'season_message': season_message,
      'original_video_title': title,
      'original_video_bvid': bvid,
      'original_video_aid': aid
    }
  }


def _parse_media_collection(final_url, media_id, qn, cookie):
  collection = _get_media_collection_info(media_id, cookie=cookie)
  collection_code = (collection or {}).get('code')
  collection_message = (collection or {}).get('message')
  c_data = (collection or {}).get('data') or {}
  
  if collection_code is not None and str(collection_code) != '0':
    raise ValueError(str(collection_message or collection_code))
  
  collection_title = _sanitize_filename(c_data.get('title') or '')
  collection_desc = c_data.get('intro') or ''
  upper = c_data.get('upper') or {}
  owner_name = None
  if isinstance(upper, dict):
    v = upper.get('name')
    if v:
      owner_name = str(v)
  
  media_list = c_data.get('media_list') or []
  
  if not media_list:
    raise ValueError('no media in collection')
  
  videos = []
  for idx, media in enumerate(media_list):
    bvid = media.get('bvid')
    aid = media.get('id')
    title = _sanitize_filename(media.get('title') or f'video_{idx + 1}')
    duration = media.get('duration')
    page = media.get('page')
    
    if not bvid and not aid:
      continue
    
    videos.append({
      'bvid': bvid,
      'aid': aid,
      'title': title,
      'duration': duration,
      'duration_text': _format_duration(duration),
      'page': page,
      'index': idx + 1
    })
  
  if not videos:
    raise ValueError('no valid videos in collection')
  
  return {
    'ok': True,
    'type': 'collection',
    'title': collection_title,
    'description': collection_desc,
    'owner': owner_name,
    'media_id': media_id,
    'total_videos': len(videos),
    'videos': videos,
    'final_url': final_url,
    'debug': {
      'has_cookie': True if cookie else False,
      'has_sessdata': True if (cookie and ('SESSDATA=' in cookie)) else False,
      'collection_code': collection_code,
      'collection_message': collection_message
    }
  }


def main(argv):
  if len(argv) < 2:
    sys.stderr.write('missing url\n')
    return 2
  url = argv[1]
  qn = None
  cookie = os.environ.get('BILI_COOKIE') or None
  force_single = False
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
    if a == '--force-single':
      force_single = True
      i += 1
      continue
    i += 1
  result = parse_bilibili(url, qn=qn, cookie=cookie, force_single=force_single)
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
