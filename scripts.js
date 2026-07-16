// Variable global para el buscador y selección
let listaPersonasBombona = []; 
let personaSeleccionada = null; 

function escaparHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mostrarMensajeExito(titulo, mensaje, icono = 'fa-circle-check') {
    const overlay = document.createElement('div');
    overlay.className = 'toast-exito-overlay';
    overlay.innerHTML = `
        <div class="toast-exito">
            <div class="toast-exito-icon"><i class="fas ${icono}"></i></div>
            <h3>${titulo}</h3>
            <p>${mensaje}</p>
            <button type="button" class="btn-submit toast-exito-btn">Aceptar</button>
        </div>
    `;
    document.body.appendChild(overlay);

    const cerrar = () => overlay.remove();
    overlay.querySelector('.toast-exito-btn').onclick = cerrar;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cerrar();
    });
}

// 1. FUNCIÓN PRINCIPAL DE NAVEGACIÓN
function mostrarSeccion(id, element) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    const seccionActiva = document.getElementById(id);
    if (seccionActiva) {
        seccionActiva.classList.add('active');
        seccionActiva.style.display = 'block';
        
        if (element) element.classList.add('active');
        
        // EJECUTAR CARGAS ESPECÍFICAS
        if (id === 'dashboard') cargarEstadisticas();
        if (id === 'lista-personas') cargarPersonas();
        
        if (id === 'registro-bombonas') {
            personaSeleccionada = null;
            const busqueda = document.getElementById('busqueda-persona');
            if (busqueda) busqueda.value = '';
            cargarPersonasParaBuscadorBombonas();
            cargarTablaRegistroBombonas();
            if (document.getElementById('estadisticas-calles-grid')) {
                cargarEstadisticasCallesMiCalle();
            }
            const secCant = document.getElementById('seccion-cantidades');
            if (secCant) secCant.style.display = 'none';
        }

        if (id === 'gestion-compras-modulo') {
            cargarTablaParaVentas();
            document.getElementById('formulario-compra').style.display = 'none';
        }
        
        // GESTIÓN DE BOMBONAS - SECCIÓN COMÚN
        if (id === 'gestionar_bombonas') {
            cargarTablaParaVentas();
            cargarHistorialVentas();
            actualizarEstadisticasVentasPorCalle();

            const formCompra = document.getElementById('formulario-compra');
            if(formCompra) formCompra.style.display = 'none';
        }
        
        if (id === 'estadisticas-calles') {
            cargarEstadisticasCalles();
        }
    }
}

// --- GESTIÓN DE BOMBONAS ---

// 2. Cargar TODAS las personas registradas para el buscador de bombonas
async function cargarPersonasParaBuscadorBombonas() {
    try {
        const datosSesion = sessionStorage.getItem('usuario');
        const usuarioLogueado = datosSesion ? JSON.parse(datosSesion) : null;

        const response = await fetch('/personas');
        const data = await response.json();
        let personas = data.personas || [];

        if (usuarioLogueado && usuarioLogueado.id_rol === 2 && usuarioLogueado.calle) {
            personas = personas.filter(p => p.calle === usuarioLogueado.calle);
        }

        listaPersonasBombona = personas;
        filtrarPersonasParaBombona();
    } catch (e) {
        console.error("Error cargando buscador:", e);
    }
}

// 3. Filtrar resultados dinámicamente (sin límite de resultados)
function filtrarPersonasParaBombona() {
    const inputBusqueda = document.getElementById('busqueda-persona');
    const busqueda = inputBusqueda ? inputBusqueda.value.toLowerCase().trim() : '';
    const contenedor = document.getElementById('lista-resultados-persona');

    if (!contenedor) return;

    if (personaSeleccionada && inputBusqueda) {
        const textoSeleccion = `${personaSeleccionada.cedula} - ${personaSeleccionada.nombre} ${personaSeleccionada.apellido}`.toLowerCase();
        if (busqueda !== textoSeleccion) {
            personaSeleccionada = null;
        }
    }

    contenedor.innerHTML = '';

    if (listaPersonasBombona.length === 0) {
        contenedor.innerHTML = '<div class="resultado-vacio">No hay personas registradas</div>';
        return;
    }

    const filtrados = busqueda
        ? listaPersonasBombona.filter(p =>
            p.cedula.toString().includes(busqueda) ||
            (p.nombre && p.nombre.toLowerCase().includes(busqueda)) ||
            (p.apellido && p.apellido.toLowerCase().includes(busqueda)) ||
            `${p.nombre} ${p.apellido}`.toLowerCase().includes(busqueda)
        )
        : listaPersonasBombona;

    if (filtrados.length === 0) {
        contenedor.innerHTML = '<div class="resultado-vacio">No se encontraron resultados</div>';
        return;
    }

    const contador = document.getElementById('contador-resultados-bombona');
    if (contador) contador.textContent = `${filtrados.length} persona${filtrados.length !== 1 ? 's' : ''}`;

    filtrados.forEach(p => {
        const item = document.createElement('div');
        item.className = 'resultado-persona-item';
        item.dataset.id = p.id_persona;
        item.innerHTML = `
            <div class="resultado-persona-info">
                <span class="resultado-cedula"><i class="fas fa-id-card"></i> ${p.cedula}</span>
                <span class="resultado-nombre">${p.nombre} ${p.apellido}</span>
            </div>
            <i class="fas fa-chevron-right resultado-arrow"></i>`;
        item.onclick = () => seleccionarPersonaBombona(p, item);
        contenedor.appendChild(item);
    });
}

function seleccionarPersonaBombona(persona, elemento) {
    document.querySelectorAll('.resultado-persona-item').forEach(el => el.classList.remove('selected'));
    if (elemento) elemento.classList.add('selected');
    personaSeleccionada = persona;

    const inputBusqueda = document.getElementById('busqueda-persona');
    if (inputBusqueda) {
        inputBusqueda.value = `${persona.cedula} - ${persona.nombre} ${persona.apellido}`;
    }
}

// 4. Al dar click en "Seleccionar"
function prepararFormularioRegistro() {
    if (!personaSeleccionada) {
        const seleccionado = document.querySelector('.resultado-persona-item.selected');
        if (seleccionado) {
            const idPersona = seleccionado.dataset.id;
            personaSeleccionada = listaPersonasBombona.find(p => p.id_persona == idPersona);
        }
    }

    if (!personaSeleccionada) {
        if (typeof mostrarMensajeExito === 'function') {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'form-validation-alert';
            alertDiv.style.display = 'flex';
            alertDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Por favor, selecciona una persona de la lista.';
            const searchBox = document.querySelector('.form-group-search');
            if (searchBox && !searchBox.querySelector('.form-validation-alert')) {
                searchBox.insertBefore(alertDiv, searchBox.firstChild);
                setTimeout(() => alertDiv.remove(), 4000);
            }
        } else {
            alert("Por favor, selecciona una persona de la lista.");
        }
        return;
    }

    document.getElementById('seccion-cantidades').style.display = 'block';
    document.getElementById('qty-10kg').value = '';
    document.getElementById('qty-18kg').value = '';
    document.getElementById('qty-27kg').value = '';
    document.getElementById('qty-43kg').value = '';
    document.getElementById('seccion-cantidades').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 5. Guardar Registro
async function guardarNuevoRegistroBombona() {
    if (!personaSeleccionada) return alert("Debe seleccionar un usuario primero.");

    const qty10 = parseInt(document.getElementById('qty-10kg').value) || 0;
    const qty18 = parseInt(document.getElementById('qty-18kg').value) || 0;
    const qty27 = parseInt(document.getElementById('qty-27kg').value) || 0;
    const qty43 = parseInt(document.getElementById('qty-43kg').value) || 0;

    if (qty10 === 0 && qty18 === 0 && qty27 === 0 && qty43 === 0) {
        return alert("Debe indicar la cantidad de al menos un tipo de cilindro.");
    }

    try {
        const response = await fetch('/bombonas/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_persona: personaSeleccionada.id_persona,
                bombonas_10kg: qty10, 
                bombonas_18kg: qty18,
                bombonas_27kg: qty27,
                bombonas_43kg: qty43
            })
        });

        if (response.ok) {
            mostrarMensajeExito(
                "¡Bombonas registradas!",
                "El inventario de cilindros se asignó correctamente al ciudadano.",
                "fa-gas-pump"
            );
            await cargarTablaRegistroBombonas(); 
            await cargarPersonasParaBuscadorBombonas(); 
            if (typeof cargarEstadisticas === 'function') {
                cargarEstadisticas();
            }
            document.getElementById('seccion-cantidades').style.display = 'none';
            mostrarSeccion('registro-bombonas'); 
        } else {
            const err = await response.json();
            alert(err.error); 
        }
    } catch (e) {
        alert("Error de conexión");
    }
}

// 6. Cargar registros detallados
async function cargarTablaRegistroBombonas() {
    try {
        const datosSesion = sessionStorage.getItem('usuario');
        const usuarioLogueado = datosSesion ? JSON.parse(datosSesion) : null;
        let url = '/bombonas/registros/detallado';
        if (usuarioLogueado && usuarioLogueado.id_rol === 2 && usuarioLogueado.calle) {
            url += `?calle=${encodeURIComponent(usuarioLogueado.calle)}`;
        }

        const response = await fetch(url);
        const data = await response.json();
        const tbody = document.getElementById('tabla-registro-bombonas');
        if(!tbody) return;
        
        tbody.innerHTML = '';

        data.registros.forEach(r => {
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td>${escaparHtml(r.cedula)}</td>
                <td>${escaparHtml(r.nombre)}</td>
                <td>${escaparHtml(r.apellido)}</td>
                <td>${escaparHtml(r.sexo)}</td>
                <td>${escaparHtml(r.edad || "-")}</td>
                <td>${escaparHtml(r.celular || "-")}</td>
                <!-- Celdas editables por kg -->
                <td style="text-align: center;">
                    <input type="number" class="edit-input" value="${r.bombonas_10kg}" id="qty10-${r.id_registro}">
                </td>
                <td style="text-align: center;">
                    <input type="number" class="edit-input" value="${r.bombonas_18kg}" id="qty18-${r.id_registro}">
                </td>
                <td style="text-align: center;">
                    <input type="number" class="edit-input" value="${r.bombonas_27kg}" id="qty27-${r.id_registro}">
                </td>
                <td style="text-align: center;">
                    <input type="number" class="edit-input" value="${r.bombonas_43kg}" id="qty43-${r.id_registro}">
                </td>
                <td class="acciones">
                    <button class="btn-update" onclick="actualizarRegistro(${r.id_registro})" title="Guardar cambios">&#10004;&#65039;</button>
                    <button class="btn-delete" onclick="eliminarRegistro(${r.id_registro})" title="Eliminar">&#128465;&#65039;</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error en tabla:", e);
    }
}

// 7. Actualizar registro
async function actualizarRegistro(id) {
    const data = {
        id_registro: id,
        bombonas_10kg: document.getElementById(`qty10-${id}`).value,
        bombonas_18kg: document.getElementById(`qty18-${id}`).value,
        bombonas_27kg: document.getElementById(`qty27-${id}`).value,
        bombonas_43kg: document.getElementById(`qty43-${id}`).value
    };

    const res = await fetch('/bombonas/actualizar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (res.ok) {
        alert("¡Cambio guardado!");
        if (typeof cargarEstadisticas === 'function') {
            cargarEstadisticas();
        }
    }
    cargarTablaRegistroBombonas(); 
    cargarPersonasParaBuscadorBombonas();
}

// 8. Eliminar registro
async function eliminarRegistro(id) {
    if (!confirm("¿Seguro que quieres borrar este registro?")) return;
    
    const res = await fetch(`/bombonas/eliminar/${id}`, { method: 'DELETE' });
    if (res.ok) {
        alert("Registro eliminado");
        if (typeof cargarEstadisticas === 'function') {
            cargarEstadisticas();
        }
        await cargarTablaRegistroBombonas(); 
        await cargarPersonasParaBuscadorBombonas(); 
    }
}

// 9. Cargar tabla para ventas
async function cargarTablaParaVentas() {
    try {
        const datosSesion = sessionStorage.getItem('usuario');
        const usuarioLogueado = datosSesion ? JSON.parse(datosSesion) : null;
        let url = '/bombonas/registros/detallado';
        if (usuarioLogueado && usuarioLogueado.id_rol === 2 && usuarioLogueado.calle) {
            url += `?calle=${encodeURIComponent(usuarioLogueado.calle)}`;
        }

        const response = await fetch(url);
        const data = await response.json();
        const tbody = document.getElementById('tabla-usuarios-compras');
        if(!tbody) return;
        
        tbody.innerHTML = '';

        data.registros.forEach(r => {
            const tr = document.createElement('tr');
            const fechaRef = r.fecha_registro ? new Date(r.fecha_registro).toLocaleDateString() : 'N/A';

            const safeRegistro = JSON.stringify(r).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            tr.innerHTML = `
                <td>${escaparHtml(r.cedula)}</td>
                <td>${escaparHtml(r.nombre)} ${escaparHtml(r.apellido)}</td>
                <td>10kg: ${escaparHtml(r.bombonas_10kg)} | 18kg: ${escaparHtml(r.bombonas_18kg)} | 27kg: ${escaparHtml(r.bombonas_27kg)} | 43kg: ${escaparHtml(r.bombonas_43kg)}</td>
                <td>${fechaRef}</td>
                <td>
                    <button class="btn-select" onclick="seleccionarParaCompra(JSON.parse(this.dataset.registro))" data-registro='${safeRegistro}'>
                        Seleccionar <i class="fas fa-hand-pointer"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error al cargar tabla de ventas:", e);
    }
}

// 10. Seleccionar para compra
function seleccionarParaCompra(registro) {
    window.registroVentaActual = registro; 

    const clienteSpan = document.getElementById('cliente-nombre');
    if(clienteSpan) clienteSpan.textContent = `${registro.nombre} ${registro.apellido}`;

    const formCompra = document.getElementById('formulario-compra');
    if(formCompra) {
        formCompra.style.display = 'block';
        formCompra.scrollIntoView({ behavior: 'smooth' });
    }

    // Limpiar campos para los 4 cilindros
    document.getElementById('v-10kg').value = 0;
    document.getElementById('v-18kg').value = 0;
    document.getElementById('v-27kg').value = 0;
    document.getElementById('v-43kg').value = 0;
    document.getElementById('v-monto').value = '';
    if (document.getElementById('v-referencia-texto')) document.getElementById('v-referencia-texto').value = '';
    if (typeof resetFileUpload === 'function') resetFileUpload('v-referencia-foto');
}

// 11. Validar y procesar venta
async function validarYProcesarVenta() {
    const qty10 = parseInt(document.getElementById('v-10kg').value) || 0;
    const qty18 = parseInt(document.getElementById('v-18kg').value) || 0;
    const qty27 = parseInt(document.getElementById('v-27kg').value) || 0;
    const qty43 = parseInt(document.getElementById('v-43kg').value) || 0;
    const monto = document.getElementById('v-monto').value;
    const metodo = document.getElementById('v-metodo').value;
    const referenciaTexto = document.getElementById('v-referencia-texto').value.trim();
    const referenciaFotoInput = document.getElementById('v-referencia-foto');
    let referenciaFoto = null;

    if (referenciaFotoInput && referenciaFotoInput.files.length > 0) {
        const file = referenciaFotoInput.files[0];
        referenciaFoto = file.name;
    }

    if (qty10 === 0 && qty18 === 0 && qty27 === 0 && qty43 === 0) {
        return alert("⚠️ Error: Debe ingresar al menos una cantidad de bombonas.");
    }
    if (!monto || monto <= 0) {
        return alert("⚠️ Error: Debe ingresar un monto válido.");
    }
    if ((metodo === 'Pago Móvil' || metodo === 'Transferencia') && !referenciaTexto && !referenciaFoto) {
        return alert("⚠️ Error: Para pagos electrónicos debe agregar referencia (texto o foto).");
    }

    const registro = window.registroVentaActual;
    if (!registro) return alert("❌ Error: No se ha seleccionado un beneficiario.");

    const datosVenta = {
        id_registro: registro.id_registro,
        id_persona: registro.id_persona,
        qty10: qty10,
        qty18: qty18,
        qty27: qty27,
        qty43: qty43,
        monto: monto,
        metodo: metodo,
        referencia_texto: referenciaTexto,
        referencia_foto: referenciaFoto
    };

    try {
        const response = await fetch('/bombonas/comprar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosVenta)
        });

        const resultado = await response.json();

        if (response.ok) {
            mostrarMensajeExito(
                "¡Compra confirmada!",
                resultado.message || "La venta de gas se procesó correctamente.",
                "fa-circle-check"
            );

            document.getElementById('formulario-compra').style.display = 'none';
            document.getElementById('v-10kg').value = 0;
            document.getElementById('v-18kg').value = 0;
            document.getElementById('v-27kg').value = 0;
            document.getElementById('v-43kg').value = 0;
            document.getElementById('v-monto').value = '';
            if (document.getElementById('v-referencia-texto')) document.getElementById('v-referencia-texto').value = '';
            if (document.getElementById('v-referencia-foto')) document.getElementById('v-referencia-foto').value = '';
            if (typeof resetFileUpload === 'function') resetFileUpload('v-referencia-foto');

            cargarTablaParaVentas();
            cargarHistorialVentas();
            if (resultado.actualizar_estadisticas) {
                actualizarEstadisticasVentasPorCalle();
            }
            if (typeof cargarEstadisticas === 'function') {
                cargarEstadisticas();
            }
        } else {
            alert("⚠️ Atención: " + (resultado.error || "No se pudo procesar la venta"));
        }
    } catch (error) {
        console.error("Error en la comunicación:", error);
        alert("❌ Error de conexión con el servidor.");
    }
}

// 12. Cargar historial de ventas
async function cargarHistorialVentas() {
    try {
        const datosSesion = sessionStorage.getItem('usuario');
        const usuarioLogueado = datosSesion ? JSON.parse(datosSesion) : null;
        let url = '/bombonas/historial-ventas';
        if (usuarioLogueado && usuarioLogueado.id_rol === 2 && usuarioLogueado.calle) {
            url += `?calle=${encodeURIComponent(usuarioLogueado.calle)}`;
        }

        const response = await fetch(url);
        const data = await response.json();
        const tbody = document.getElementById('tabla-historial-pagos');

        if(!tbody) return;
        tbody.innerHTML = '';

        if (!data.historial || data.historial.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No se han procesado ventas aún</td></tr>';
            return;
        }

        data.historial.forEach(v => {
            const tr = document.createElement('tr');
            const fechaPago = new Date(v.fecha_pago).toLocaleString();

            let referenciaHTML = '-';
            if (v.referencia_texto || v.referencia_foto) {
                referenciaHTML = '';
                if (v.referencia_texto) {
                    referenciaHTML += `<span style="margin-right: 5px;">📝 ${v.referencia_texto}</span>`;
                }
                if (v.referencia_foto) {
                    referenciaHTML += `<span style="margin-right: 5px;">📷 Foto</span>`;
                }
            }

            const cantStr = [];
            if (v.cant_10kg) cantStr.push(`${v.cant_10kg}x10kg`);
            if (v.cant_18kg) cantStr.push(`${v.cant_18kg}x18kg`);
            if (v.cant_27kg) cantStr.push(`${v.cant_27kg}x27kg`);
            if (v.cant_43kg) cantStr.push(`${v.cant_43kg}x43kg`);
            if (cantStr.length === 0) cantStr.push('Ninguno');

            tr.innerHTML = `
                <td>${escaparHtml(v.nombre)} ${escaparHtml(v.apellido)}</td>
                <td>${escaparHtml(cantStr.join(' / '))}</td>
                <td>${escaparHtml(v.monto_pagado)} Bs.</td>
                <td>${escaparHtml(v.metodo_pago)}</td>
                <td>${referenciaHTML}</td>
                <td>${fechaPago}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error al cargar historial de ventas:", e);
    }
}

// 13. Cargar estadísticas por calle
function renderTarjetasEstadisticasCalles(estadisticas, grid) {
    estadisticas.forEach(est => {
        const card = document.createElement('div');
        card.className = 'stat-card-calle';
        card.innerHTML = `
            <div class="calle-header">
                <h3>${escaparHtml(est.calle)}</h3>
            </div>
            <div class="calle-stats">
                <div class="stat-row">
                    <span class="stat-label">Personas:</span>
                    <span class="stat-value">${escaparHtml(est.total_personas)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Con Registro:</span>
                    <span class="stat-value">${escaparHtml(est.personas_con_registro)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Total Cilindros:</span>
                    <span class="stat-value highlight">${escaparHtml(est.total_cilindros || 0)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">10kg:</span>
                    <span class="stat-value">${escaparHtml(est.total_10kg || 0)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">18kg:</span>
                    <span class="stat-value">${escaparHtml(est.total_18kg || 0)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">27kg:</span>
                    <span class="stat-value">${escaparHtml(est.total_27kg || 0)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">43kg:</span>
                    <span class="stat-value">${escaparHtml(est.total_43kg || 0)}</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function cargarEstadisticasCalles() {
    try {
        console.log("Cargando estadísticas por calle...");
        const response = await fetch('/bombonas/estadisticas-calles');
        const data = await response.json();
        const grid = document.getElementById('estadisticas-grid');

        if(!grid) return;
        grid.innerHTML = '';

        if (!data.estadisticas || data.estadisticas.length === 0) {
            grid.innerHTML = '<p style="text-align:center; grid-column: span 4;">No hay datos de estadísticas por calle</p>';
            return;
        }

        renderTarjetasEstadisticasCalles(data.estadisticas, grid);
    } catch (e) {
        console.error("Error al cargar estadísticas por calle:", e);
    }
}

async function cargarEstadisticasCallesMiCalle() {
    try {
        const grid = document.getElementById('estadisticas-calles-grid');
        if (!grid) return;

        const datosSesion = sessionStorage.getItem('usuario');
        const usuarioLogueado = datosSesion ? JSON.parse(datosSesion) : null;
        let calleUsuario = (usuarioLogueado?.calle || '').trim();

        if (!calleUsuario && usuarioLogueado?.cedula) {
            const resPersonas = await fetch('/personas');
            const dataPersonas = await resPersonas.json();
            const persona = (dataPersonas.personas || []).find(
                p => String(p.cedula) === String(usuarioLogueado.cedula)
            );
            if (persona?.calle) {
                calleUsuario = persona.calle.trim();
                usuarioLogueado.calle = calleUsuario;
                sessionStorage.setItem('usuario', JSON.stringify(usuarioLogueado));
            }
        }

        if (!calleUsuario) {
            grid.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 2rem;">No tiene una calle asignada. Contacte al administrador.</p>';
            return;
        }

        const response = await fetch('/bombonas/estadisticas-calles');
        const data = await response.json();
        grid.innerHTML = '';

        const estadisticas = (data.estadisticas || []).filter(
            (est) => est.calle && est.calle.trim() === calleUsuario
        );

        if (estadisticas.length === 0) {
            grid.innerHTML = `<p style="text-align:center; padding: 2rem;">No hay datos de inventario para <strong>${calleUsuario}</strong></p>`;
            return;
        }

        renderTarjetasEstadisticasCalles(estadisticas, grid);
    } catch (e) {
        console.error("Error al cargar estadísticas de mi calle:", e);
        const grid = document.getElementById('estadisticas-calles-grid');
        if (grid) {
            grid.innerHTML = '<p style="text-align:center; color: var(--danger); padding: 2rem;">Error al cargar estadísticas</p>';
        }
    }
}

function actualizarEstadisticasVentasPorCalle() {
    const datosSesion = sessionStorage.getItem('usuario');
    const usuarioLogueado = datosSesion ? JSON.parse(datosSesion) : null;
    if (usuarioLogueado && usuarioLogueado.id_rol === 2) {
        cargarEstadisticasVentaMiCalle();
    } else {
        cargarEstadisticasVentasCalles();
    }
}

function mostrarInfoEstadisticasVentas(data) {
    const infoEl = document.getElementById('estadisticas-ventas-info');
    if (!infoEl || !data.actualizado) return;
    const fecha = new Date(data.actualizado).toLocaleString('es-VE');
    infoEl.textContent = `Ventas del lote actual (últimos ${data.periodo_dias || 15} días). Se actualiza al iniciar un nuevo lote, no en compras seguidas. Última actualización: ${fecha}`;
}

function renderTarjetasEstadisticasVentas(estadisticas, grid) {
    estadisticas.forEach(est => {
        const card = document.createElement('div');
        card.className = 'stat-card-calle';
        card.innerHTML = `
            <div class="calle-header" style="background: linear-gradient(135deg, #104358 0%, #159895 100%);">
                <h3>${escaparHtml(est.calle)}</h3>
            </div>
            <div class="calle-stats">
                <div class="stat-row" style="border-bottom: 2px solid rgba(21, 152, 149, 0.2); margin-bottom: 0.5rem; padding-bottom: 0.5rem;">
                    <span class="stat-label" style="font-weight: bold; color: var(--primary);">Total Bombonas:</span>
                    <span class="stat-value highlight" style="font-size: 1.1rem; font-weight: bold; color: var(--primary);">${escaparHtml(est.total_bombonas || 0)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">10kg:</span>
                    <span class="stat-value">${escaparHtml(est.total_10kg || 0)} (${parseFloat(est.monto_10kg || 0).toFixed(2)} Bs.)</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">18kg:</span>
                    <span class="stat-value">${escaparHtml(est.total_18kg || 0)} (${parseFloat(est.monto_18kg || 0).toFixed(2)} Bs.)</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">27kg:</span>
                    <span class="stat-value">${escaparHtml(est.total_27kg || 0)} (${parseFloat(est.monto_27kg || 0).toFixed(2)} Bs.)</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">43kg:</span>
                    <span class="stat-value">${escaparHtml(est.total_43kg || 0)} (${parseFloat(est.monto_43kg || 0).toFixed(2)} Bs.)</span>
                </div>
                <div class="stat-row" style="border-top: 2px solid rgba(21, 152, 149, 0.2); margin-top: 0.5rem; padding-top: 0.5rem;">
                    <span class="stat-label" style="font-weight: bold; color: #104358;">Total Recaudado:</span>
                    <span class="stat-value highlight" style="font-size: 1.1rem; font-weight: bold; color: #104358;">${parseFloat(est.total_monto || 0).toFixed(2)} Bs.</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// 14. Cargar estadísticas de ventas por calle (Global)
async function cargarEstadisticasVentasCalles() {
    try {
        console.log("Cargando estadísticas de ventas por calle...");
        const response = await fetch('/bombonas/estadisticas-ventas-calles');
        const data = await response.json();
        const grid = document.getElementById('estadisticas-ventas-grid');

        if(!grid) return;
        grid.innerHTML = '';
        mostrarInfoEstadisticasVentas(data);

        if (!data.estadisticas || data.estadisticas.length === 0) {
            grid.innerHTML = '<p style="text-align:center; grid-column: span 4;">No hay ventas registradas en los últimos 15 días</p>';
            return;
        }

        renderTarjetasEstadisticasVentas(data.estadisticas, grid);
    } catch (e) {
        console.error("Error al cargar estadísticas de ventas por calle:", e);
    }
}

// 15. Cargar estadísticas de ventas de Mi Calle (Secretario)
async function cargarEstadisticasVentaMiCalle() {
    try {
        console.log("Cargando estadísticas de ventas de Mi Calle...");
        const datosSesion = sessionStorage.getItem('usuario');
        const usuarioLogueado = datosSesion ? JSON.parse(datosSesion) : null;
        if (!usuarioLogueado || !usuarioLogueado.calle) {
            console.log("No hay calle definida para el usuario");
            return;
        }
        
        const response = await fetch(`/bombonas/estadisticas-ventas-calles?calle=${encodeURIComponent(usuarioLogueado.calle)}`);
        const data = await response.json();
        const grid = document.getElementById('estadisticas-ventas-grid');

        if(!grid) return;
        grid.innerHTML = '';
        mostrarInfoEstadisticasVentas(data);

        if (!data.estadisticas || data.estadisticas.length === 0) {
            grid.innerHTML = '<p style="text-align:center; grid-column: span 4;">No hay ventas registradas en los últimos 15 días para tu calle</p>';
            return;
        }

        renderTarjetasEstadisticasVentas(data.estadisticas, grid);
    } catch (e) {
        console.error("Error al cargar estadísticas de ventas de Mi Calle:", e);
    }
}

// Cargas iniciales al abrir la web (solo si no hay otro handler en la página)
if (!window._scriptsJsLoaded) {
    window._scriptsJsLoaded = true;
}

function abrirModalEditar(id_persona, cedula, nombre, apellido, sexo, edad, id_estado_civil, celular, carga_familiar, calle, estatus, fecha_registro) {
    document.getElementById("edit-id").value = id_persona;
    document.getElementById("edit-cedula").value = cedula;
    document.getElementById("edit-nombre").value = nombre;
    document.getElementById("edit-apellido").value = apellido;
    document.getElementById("edit-sexo").value = sexo;
    document.getElementById("edit-edad").value = edad;
    document.getElementById("edit-civil").value = id_estado_civil; 
    document.getElementById("edit-celular").value = celular;
    document.getElementById("edit-carga").value = carga_familiar;
    document.getElementById("edit-calle").value = calle;
    document.getElementById("edit-estatus").value = estatus;
    
    if (fecha_registro) {
        const fecha = new Date(fecha_registro);
        const año = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        const fechaInput = document.getElementById("edit-fecha");
        if (fechaInput._flatpickr) {
            fechaInput._flatpickr.setDate(`${año}-${mes}-${dia}`, true);
        } else {
            fechaInput.value = `${año}-${mes}-${dia}`;
        }
    } else {
        const fechaInput = document.getElementById("edit-fecha");
        if (fechaInput._flatpickr) {
            fechaInput._flatpickr.clear();
        } else {
            fechaInput.value = "";
        }
    }
    
    const modal = document.getElementById("modal-editar-persona");
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    modal.onclick = (e) => {
        if (e.target === modal) cerrarModalEditar();
    };
    
    if (typeof initFlatpickr === 'function') {
        setTimeout(() => initFlatpickr(), 100);
    }
    if (typeof initTomSelect === 'function') {
        setTimeout(() => initTomSelect(), 100);
    }
}

function cerrarModalEditar() {
    document.getElementById("modal-editar-persona").style.display = "none";
    document.body.style.overflow = "";
}

// EVENTO PARA PROCESAR EL CAMBIO EN LA BASE DE DATOS
const formEditar = document.getElementById("form-editar-persona");
if (formEditar) {
    formEditar.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const idPersona = document.getElementById("edit-id").value;
        
        const cedula = document.getElementById("edit-cedula").value.trim();
        const nombre = document.getElementById("edit-nombre").value.trim();
        const apellido = document.getElementById("edit-apellido").value.trim();
        const sexo = document.getElementById("edit-sexo").value;
        const edad = document.getElementById("edit-edad").value;
        const id_estado_civil = document.getElementById("edit-civil").value;
        const celular = document.getElementById("edit-celular").value.trim();
        const carga_familiar = document.getElementById("edit-carga").value;
        const calle = document.getElementById("edit-calle").value.trim();
        const estatus = document.getElementById("edit-estatus").value;
        const fecha_registro = document.getElementById("edit-fecha").value;
        const fechaInput = document.getElementById("edit-fecha");
        let fechaFinal = fecha_registro;
        if (fechaInput._flatpickr && fechaInput._flatpickr.selectedDates[0]) {
            fechaFinal = fechaInput._flatpickr.selectedDates[0].toISOString().split('T')[0];
        }

        const regexSoloLetas = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/; 
        const regexSoloNumeros = /^\d+$/;                   

        if (!validarFormulario(formEditar)) return;

        if (!cedula || !nombre || !apellido || !sexo) {
            return;
        }

        if (!regexSoloNumeros.test(cedula)) {
            alert("La cédula debe contener únicamente números.");
            return;
        }

        if (!regexSoloLetas.test(nombre)) {
            alert("El nombre no puede contener números ni caracteres especiales.");
            return;
        }

        if (!regexSoloLetas.test(apellido)) {
            alert("El apellido no puede contener números ni caracteres especiales.");
            return;
        }

        if (edad && (parseInt(edad) < 0 || parseInt(edad) > 120)) {
            alert("Por favor, introduce una edad válida (entre 0 y 120 años).");
            return;
        }

        if (celular && !regexSoloNumeros.test(celular.replace(/[-\s]/g, ""))) {
            alert("El número de celular debe contener solo dígitos numéricos.");
            return;
        }

        if (carga_familiar && parseInt(carga_familiar) < 0) {
            alert("La carga familiar no puede ser un número negativo.");
            return;
        }

        const datosActualizados = {
            cedula,
            nombre,
            apellido,
            sexo,
            edad: edad || null,
            id_estado_civil,
            celular: celular || null,
            carga_familiar: carga_familiar || 0,
            calle: calle || null,
            estatus: estatus || 'Activo',
            fecha_registro: fechaFinal || null
        };

        try {
            const response = await fetch(`/personas/${idPersona}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(datosActualizados)
            });

            const result = await response.json();

            if (response.ok) {
                mostrarMensajeExito('¡Cambios guardados!', 'Los datos se actualizaron correctamente en el sistema.', 'fa-circle-check');
                cerrarModalEditar();
                if (typeof cargarPersonas === 'function') cargarPersonas();
            } else {
                alert(result.error || "Ocurrió un error al actualizar");
            }
        } catch (error) {
            console.error("Error en la conexión:", error);
            alert("Error de red al intentar conectar con el servidor");
        }
    });
}