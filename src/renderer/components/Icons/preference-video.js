import Icon from '@/components/Icons/Icon'

Icon.register({
  'preference-video': {
    'width': 24,
    'height': 24,
    'raw': `
      <rect x="2" y="3" width="20" height="18" rx="2" ry="2" fill="none" stroke-miterlimit="10"/>
      <polygon points="10 8 10 16 16 12" fill="currentColor" stroke="none"/>
    `,
    'g': {
      'stroke': 'currentColor',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-width': '2.2'
    }
  }
})
