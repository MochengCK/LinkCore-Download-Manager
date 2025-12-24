import Icon from '@/components/Icons/Icon'

Icon.register({
  'task-plan': {
    'width': 24,
    'height': 24,
    'raw': `<rect x="3" y="4" width="18" height="17" rx="2" ry="2" fill="none" stroke-miterlimit="10" />
      <line x1="7" y1="2.5" x2="7" y2="6" fill="none" stroke-miterlimit="10" />
      <line x1="17" y1="2.5" x2="17" y2="6" fill="none" stroke-miterlimit="10" />
      <line x1="3" y1="8" x2="21" y2="8" fill="none" stroke-miterlimit="10" />
      <polyline points="9,15 11.5,17 15,11.5" fill="none" stroke-miterlimit="10" />`,
    'g': {
      'stroke': 'currentColor',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-width': '2'
    }
  }
})
