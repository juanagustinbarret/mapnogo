import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Comercio } from '@/types/database.types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { estaVigente } from '@/lib/fechasArgentina';

export const generarReportePDF = (
  comercio: Comercio,
  metricas: { visitas: number; whatsapp: number; comoLlegar: number },
  suscripcion: any,
  promociones: any[]
) => {
  const doc = new jsPDF();
  const fechaActual = formatDate(new Date().toISOString());

  // ENCABEZADO / BRANDING
  doc.setFillColor(16, 185, 129); // Verde Brand (Emerald-600)
  doc.rect(0, 0, 210, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('NOGOMAP', 14, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Reporte de Rendimiento Comercial', 14, 25);
  doc.text(`Fecha: ${fechaActual}`, 150, 25);

  // DATOS DEL COMERCIO
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Comercio: ${comercio.nombre}`, 14, 42);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dirección: ${comercio.direccion || 'N/A'}`, 14, 48);
  doc.text(`WhatsApp: ${comercio.whatsapp || 'N/A'}`, 14, 54);

  // RESUMEN DE MÉTRICAS (TARJETAS)
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(14, 62, 58, 28, 3, 3, 'F');
  doc.roundedRect(76, 62, 58, 28, 3, 3, 'F');
  doc.roundedRect(138, 62, 58, 28, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text('VISITAS A LA FICHA', 18, 70);
  doc.text('CONSULTAS WHATSAPP', 80, 70);
  doc.text('RUTAS "CÓMO LLEGAR"', 142, 70);

  doc.setFontSize(18);
  doc.setTextColor(16, 185, 129);
  doc.text(`${metricas.visitas}`, 18, 83);
  doc.text(`${metricas.whatsapp}`, 80, 83);
  doc.text(`${metricas.comoLlegar}`, 142, 83);

  // Las métricas son totales desde el alta (no del mes): antes el título
  // decía "Reporte Mensual"
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('Totales desde el alta del comercio en NOGOMAP.', 14, 95);

  // TABLA DE PROMOCIONES ACTIVAS
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('Publicaciones', 14, 102);

  const filasPromos = promociones.map((p) => [
    p.titulo,
    p.descripcion || '-',
    p.precio_promocional ? formatCurrency(p.precio_promocional) : 'Consulte',
    !p.aprobada ? 'Pausada' : estaVigente(p.fecha_fin) ? 'Vigente' : 'Vencida'
  ]);

  autoTable(doc, {
    startY: 106,
    head: [['Título Oferta', 'Descripción', 'Precio Promo', 'Estado']],
    body: filasPromos.length > 0 ? filasPromos : [['Sin promociones cargadas', '-', '-', '-']],
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 9 }
  });

  // ESTADO DE LA SUSCRIPCIÓN
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Estado del Plan / Suscripción', 14, finalY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  // Antes, sin suscripción decía "Activa" y "Al día"
  doc.text(`Estado actual: ${suscripcion?.estado ?? 'Sin suscripción cargada'}`, 14, finalY + 6);
  doc.text(`Próximo vencimiento: ${suscripcion?.proximo_vencimiento ? formatDate(suscripcion.proximo_vencimiento) : '-'}`, 14, finalY + 12);

  // PIE DE PÁGINA
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text('Generado automáticamente por la plataforma NOGOMAP - www.nogoyacerca.com.ar', 14, 285);

  doc.save(`Reporte_NOGOMAP_${comercio.slug}.pdf`);
};