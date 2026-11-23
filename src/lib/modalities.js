import { Watch, Smartphone, AudioLines, House, Glasses, Map, Hand } from 'lucide-react'

// Las 7 modalidades pedidas en la consigna, en el mismo orden.
export const MODALITIES = [
  {
    n: 1,
    to: '/m/reloj',
    icon: Watch,
    name: 'Reloj inteligente',
    short: 'Respira, registra cómo estás y pide ayuda desde la muñeca.',
    devices: ['Laptop', 'Móvil', 'Smartwatch con navegador'],
    tech: 'Wearable · vibración'
  },
  {
    n: 2,
    to: '/m/plegable',
    icon: Smartphone,
    name: 'Móvil y plegable',
    short: 'Chat en una pantalla y herramientas en la otra, como en un teléfono de doble pantalla.',
    devices: ['Móvil', 'Plegable', 'Laptop'],
    tech: 'Viewport Segments API'
  },
  {
    n: 3,
    to: '/m/voz',
    icon: AudioLines,
    name: 'Conversación por voz',
    short: 'Habla con Escucha sin tocar la pantalla. Responde en voz alta.',
    devices: ['Laptop', 'Móvil'],
    tech: 'Web Speech · Whisper · IA'
  },
  {
    n: 4,
    to: '/m/iot',
    icon: House,
    name: 'Hogar conectado (IoT)',
    short: 'Tu pulsera detecta estrés y la lámpara, el parlante y el difusor crean un espacio de calma.',
    devices: ['Laptop', 'Móvil', 'Pulsera Bluetooth'],
    tech: 'Web Bluetooth · automatización'
  },
  {
    n: 5,
    to: '/m/inmersivo',
    icon: Glasses,
    name: 'Santuario en realidad virtual',
    short: 'Un lugar tranquilo en 3D para respirar: bosque, playa o noche. Con visor o en pantalla.',
    devices: ['Meta Quest', 'Apple Vision Pro', 'Laptop', 'Móvil'],
    tech: 'WebXR · RV y RA'
  },
  {
    n: 6,
    to: '/m/mapa',
    icon: Map,
    name: 'Mapa 3D de ayuda',
    short: 'Centros de salud reales cerca de ti, sobre un mapa con edificios en 3D.',
    devices: ['Laptop', 'Móvil'],
    tech: 'OpenStreetMap · 3D'
  },
  {
    n: 7,
    to: '/m/gestos',
    icon: Hand,
    name: 'Gestos con la cámara',
    short: 'Guía la respiración con la mano abierta o el puño, sin tocar nada.',
    devices: ['Laptop', 'Móvil'],
    tech: 'Visión por computadora'
  }
]
