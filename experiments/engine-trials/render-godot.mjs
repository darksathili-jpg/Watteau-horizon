export function createRenderer(container, _read, ready, rendered, failure) {
  const frame = document.createElement('iframe')
  frame.title = 'Rendu Godot Web du campus fictif'
  frame.tabIndex = -1
  frame.setAttribute('aria-hidden', 'true')
  let startup = false
  window.watteauTrialRendered = rendered
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.source !== 'watteau-godot') return
    if (event.data.type === 'ready') {
      startup = true
      ready()
    } else if (event.data.type === 'error') failure(new Error('Godot Web'))
  })
  frame.src = new URL('./godot/index.html', document.baseURI).href
  container.append(frame)
  window.setTimeout(() => {
    if (!startup) failure(new Error('export Godot absent ou délai de démarrage dépassé'))
  }, 45000)
}
