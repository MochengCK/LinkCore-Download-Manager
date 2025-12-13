import Icon from '@/components/Icons/Icon'

Icon.register({
  'deselect-all': {
    'width': 24,
    'height': 24,
    'raw': `<line x1="7" y1="7" x2="17" y2="17" fill="none" stroke-miterlimit="10" />
      <line x1="17" y1="7" x2="7" y2="17" fill="none" stroke-miterlimit="10" />`,
    'g': {
      'stroke': 'currentColor',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-width': '2.5'
    }
  }
})
