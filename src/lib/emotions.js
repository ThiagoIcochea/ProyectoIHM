// Emociones del check-in del prototipo (Figma). El color se usa en el reloj, el diario y la luz IoT.
export const EMOTIONS = [
  { id: 'ansiedad', label: 'Ansiedad', color: '#F3C06B', re: /ansie|nervios|preocup|estres/ },
  { id: 'tristeza', label: 'Tristeza', color: '#7CC0F8', re: /triste|llor|bajon|deprim|solo|sola/ },
  { id: 'calma', label: 'Calma', color: '#6FD3A0', re: /calma|tranquil|bien|relaj/ },
  { id: 'enojo', label: 'Enojo', color: '#FF8A80', re: /enoj|rabia|molest|cole?ra|furia/ },
  { id: 'esperanza', label: 'Esperanza', color: '#B9A6F5', re: /esperanz|ilusion|motivad|feliz|alegr/ },
  { id: 'confusion', label: 'Confusión', color: '#C9D6DF', re: /confus|perdid|no se/ }
]
export const emotionById = (id) => EMOTIONS.find((e) => e.id === id)
