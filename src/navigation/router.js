export const routes = [
  { id: 'extractor', title: 'Extractor de formularios PDF' },
  { id: 'enlaces', title: 'Envío de enlaces y soportes' },
  { id: 'preinspeccion', title: 'Correo de preinspección DIAN' },
  { id: 'zona-franca', title: 'Retiros de zona franca' },
  { id: 'retiro-mercancia', title: 'Solicitud de retiro de mercancía' },
  { id: 'historial', title: 'Historial de operaciones' },
];

export function routeFromHash(hash) {
  const routeId = hash.replace(/^#/, '');
  return routes.find((route) => route.id === routeId) ?? routes[0];
}