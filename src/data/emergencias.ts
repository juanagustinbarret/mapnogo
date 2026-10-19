export interface ContactoEmergencia {
  id: string;
  titulo: string;
  subtitulo: string;
  telefono: string;
  categoria: 'salud' | 'seguridad' | 'servicios';
  icono: string;
}

export const CONTACTOS_EMERGENCIA: ContactoEmergencia[] = [
  {
    id: '1',
    titulo: 'Hospital San Blas',
    subtitulo: 'Guardia de Urgencias 24hs',
    telefono: '107',
    categoria: 'salud',
    icono: 'Ambulance',
  },
  {
    id: '2',
    titulo: 'Bomberos Voluntarios',
    subtitulo: 'Emergencias e Incendios',
    telefono: '100',
    categoria: 'seguridad',
    icono: 'Flame',
  },
  {
    id: '3',
    titulo: 'Comisaría Nogoyá',
    subtitulo: 'Policía de Entre Ríos',
    telefono: '101',
    categoria: 'seguridad',
    icono: 'ShieldAlert',
  },
  {
    id: '4',
    titulo: 'ENERSA (Luz)',
    subtitulo: 'Reclamos y Guardia Técnica',
    telefono: '08007770080',
    categoria: 'servicios',
    icono: 'Zap',
  },
  {
    id: '5',
    titulo: 'Obras y Servicios Sanitarios',
    subtitulo: 'Guardia de Agua y Cloacas',
    telefono: '03435421111',
    categoria: 'servicios',
    icono: 'Droplet',
  },
];