function obtenerFechaReporte() {
    return new Date().toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' });
}

function crearPdfBase(titulo) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(16, 67, 88);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Gestión Social', 14, 15);
    doc.setFontSize(12);
    doc.text(titulo, 14, 25);
    doc.setFontSize(9);
    doc.text(`Generado: ${obtenerFechaReporte()}`, 14, 31);

    return doc;
}

function descargarPdf(doc, nombreArchivo) {
    doc.save(nombreArchivo);
}

function estiloTabla() {
    return {
        startY: 42,
        headStyles: {
            fillColor: [16, 67, 88],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: [245, 248, 250] },
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 14, right: 14 },
    };
}

async function descargarPdfEstadisticasCalles() {
    try {
        const response = await fetch('/bombonas/estadisticas-calles');
        const data = await response.json();

        if (!data.estadisticas || data.estadisticas.length === 0) {
            alert('No hay datos de estadísticas por calle para exportar.');
            return;
        }

        const doc = crearPdfBase('Estadísticas por Calle — Inventario de Cilindros');

        const body = data.estadisticas.map((est) => [
            est.calle,
            String(est.total_personas || 0),
            String(est.personas_con_registro || 0),
            String(est.total_cilindros || 0),
            String(est.total_10kg || 0),
            String(est.total_18kg || 0),
            String(est.total_27kg || 0),
            String(est.total_43kg || 0),
        ]);

        const totales = data.estadisticas.reduce(
            (acc, est) => ({
                personas: acc.personas + (est.total_personas || 0),
                registro: acc.registro + (est.personas_con_registro || 0),
                cilindros: acc.cilindros + (est.total_cilindros || 0),
                kg10: acc.kg10 + (est.total_10kg || 0),
                kg18: acc.kg18 + (est.total_18kg || 0),
                kg27: acc.kg27 + (est.total_27kg || 0),
                kg43: acc.kg43 + (est.total_43kg || 0),
            }),
            { personas: 0, registro: 0, cilindros: 0, kg10: 0, kg18: 0, kg27: 0, kg43: 0 }
        );

        body.push([
            'TOTAL',
            String(totales.personas),
            String(totales.registro),
            String(totales.cilindros),
            String(totales.kg10),
            String(totales.kg18),
            String(totales.kg27),
            String(totales.kg43),
        ]);

        doc.autoTable({
            ...estiloTabla(),
            head: [['Calle', 'Personas', 'Con Registro', 'Cilindros', '10kg', '18kg', '27kg', '43kg']],
            body,
            footStyles: { fillColor: [21, 152, 149], textColor: [255, 255, 255], fontStyle: 'bold' },
        });

        const fecha = new Date().toISOString().slice(0, 10);
        descargarPdf(doc, `estadisticas-calles-${fecha}.pdf`);
    } catch (error) {
        console.error('Error al generar PDF de estadísticas por calle:', error);
        alert('No se pudo generar el PDF. Intente de nuevo.');
    }
}

async function descargarPdfEstadisticasVentas(calleFiltro) {
    try {
        let url = '/bombonas/estadisticas-ventas-calles';
        if (calleFiltro) {
            url += `?calle=${encodeURIComponent(calleFiltro)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (!data.estadisticas || data.estadisticas.length === 0) {
            alert('No hay datos de ventas para exportar.');
            return;
        }

        const titulo = calleFiltro
            ? `Estadísticas de Ventas — ${calleFiltro} (últimos 15 días)`
            : 'Estadísticas de Ventas por Calle (últimos 15 días)';

        const doc = crearPdfBase(titulo);

        const body = data.estadisticas.map((est) => [
            est.calle,
            String(est.total_bombonas || 0),
            `${est.total_10kg || 0} (${parseFloat(est.monto_10kg || 0).toFixed(2)} Bs.)`,
            `${est.total_18kg || 0} (${parseFloat(est.monto_18kg || 0).toFixed(2)} Bs.)`,
            `${est.total_27kg || 0} (${parseFloat(est.monto_27kg || 0).toFixed(2)} Bs.)`,
            `${est.total_43kg || 0} (${parseFloat(est.monto_43kg || 0).toFixed(2)} Bs.)`,
            `${parseFloat(est.total_monto || 0).toFixed(2)} Bs.`,
        ]);

        const totales = data.estadisticas.reduce(
            (acc, est) => ({
                bombonas: acc.bombonas + (est.total_bombonas || 0),
                kg10: acc.kg10 + (est.total_10kg || 0),
                m10: acc.m10 + parseFloat(est.monto_10kg || 0),
                kg18: acc.kg18 + (est.total_18kg || 0),
                m18: acc.m18 + parseFloat(est.monto_18kg || 0),
                kg27: acc.kg27 + (est.total_27kg || 0),
                m27: acc.m27 + parseFloat(est.monto_27kg || 0),
                kg43: acc.kg43 + (est.total_43kg || 0),
                m43: acc.m43 + parseFloat(est.monto_43kg || 0),
                monto: acc.monto + parseFloat(est.total_monto || 0),
            }),
            { bombonas: 0, kg10: 0, m10: 0, kg18: 0, m18: 0, kg27: 0, m27: 0, kg43: 0, m43: 0, monto: 0 }
        );

        if (!calleFiltro) {
            body.push([
                'TOTAL',
                String(totales.bombonas),
                `${totales.kg10} (${totales.m10.toFixed(2)} Bs.)`,
                `${totales.kg18} (${totales.m18.toFixed(2)} Bs.)`,
                `${totales.kg27} (${totales.m27.toFixed(2)} Bs.)`,
                `${totales.kg43} (${totales.m43.toFixed(2)} Bs.)`,
                `${totales.monto.toFixed(2)} Bs.`,
            ]);
        }

        doc.autoTable({
            ...estiloTabla(),
            head: [['Calle', 'Bombonas', '10kg', '18kg', '27kg', '43kg', 'Total Recaudado']],
            body,
            columnStyles: {
                0: { cellWidth: 28 },
                6: { halign: 'right' },
            },
        });

        const fecha = new Date().toISOString().slice(0, 10);
        const sufijo = calleFiltro ? calleFiltro.replace(/\s+/g, '-').toLowerCase() : 'todas';
        descargarPdf(doc, `estadisticas-ventas-${sufijo}-${fecha}.pdf`);
    } catch (error) {
        console.error('Error al generar PDF de estadísticas de ventas:', error);
        alert('No se pudo generar el PDF. Intente de nuevo.');
    }
}

function descargarPdfEstadisticasVentasMiCalle() {
    const datosSesion = sessionStorage.getItem('usuario');
    const usuarioLogueado = datosSesion ? JSON.parse(datosSesion) : null;
    if (!usuarioLogueado || !usuarioLogueado.calle) {
        alert('No se encontró la calle asignada a su usuario.');
        return;
    }
    descargarPdfEstadisticasVentas(usuarioLogueado.calle);
}
