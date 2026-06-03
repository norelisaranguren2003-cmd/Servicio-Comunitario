// Variable global para el buscador y selección
let listaPersonasBombona = []; 
let personaSeleccionada = null; 

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
        
        // CÓDIGO MODIFICADO CON CONTROL DE ROLES
if (id === 'registro-bombonas') {
            const datosSesion = sessionStorage.getItem('usuario');
            const usuarioLogueado = datosSesion ? JSON.parse(datosSesion) : null;

            if (usuarioLogueado && usuarioLogueado.nombre_rol === 'Administrador') {
                cargarPersonasParaBuscadorBombonas();
                cargarTablaRegistroBombonas();
                const secCant = document.getElementById('seccion-cantidades');
                if(secCant) secCant.style.display = 'none';
            } else {
                // VISTA SECRETARIO: Cargamos el buscador superior y la tabla limpia adaptada
                cargarPersonasParaBuscadorBombonasSecretario();
                cargarTablaRegistroBombonasSecretario();
            }
        }

        if (id === 'gestion-compras-modulo') {
            cargarTablaParaVentas();
            document.getElementById('formulario-compra').style.display = 'none';
        }
        
        // 🎯 AQUÍ ES DONDE SUCEDE LA MAGIA AL DAR CLIC EN GESTIÓN DE BOMBONAS
        if (id === 'gestionar_bombonas') {
            cargarTablaParaVentas();
            cargarHistorialVentas();
            
            // Evaluamos de forma segura el rol del usuario conectado desde la sesión
            try {
                const datosSesion = sessionStorage.getItem('usuario');
                const usuarioLogueado = datosSesion ? JSON.parse(datosSesion) : null;
                
                // Si el id_rol es 2 (o el valor que definiste para usuario/secretaría regular)
                if (usuarioLogueado && usuarioLogueado.id_rol === 2) {
                    console.log("👤 Modo Usuario: Cargando estadísticas de 'Mi Calle' en Gestión de Bombonas");
                    if (typeof cargarEstadisticasVentaMiCalle === 'function') {
                        cargarEstadisticasVentaMiCalle();
                    }
                } else {
                    // Si es administrador (id_rol = 1) carga el panel global de todas las calles
                    console.log("👑 Modo Admin: Cargando estadísticas globales de todas las calles");
                    if (typeof cargarEstadisticasVentasCalles === 'function') {
                        cargarEstadisticasVentasCalles();
                    }
                }
            } catch (error) {
                console.error("Error al identificar el rol en la sección gestión de bombonas:", error);
                // Plan de respaldo por si falla el JSON: si existe tu contenedor de usuario, ejecutamos su función
                if (document.getElementById('grid-calles-compras-usuario')) {
                    cargarEstadisticasVentaMiCalle();
                } else {
                    cargarEstadisticasVentasCalles();
                }
            }

            const formCompra = document.getElementById('formulario-compra');
            if(formCompra) formCompra.style.display = 'none';
        }
        
        if (id === 'estadisticas-calles') {
            cargarEstadisticasCalles();
        }
    }
}

// --- GESTIÓN DE BOMBONAS ---

// 2. Cargar personas 
async function cargarPersonasParaBuscadorBombonas() {
    try {
        const response = await fetch('/personas/sin-bombonas');
        const data = await response.json();
        
        
        listaPersonasBombona = data.personas || [];
        
        console.log("Personas disponibles para registro:", listaPersonasBombona.length);
        
        
        filtrarPersonasParaBombona(); 
    } catch (e) {
        console.error("Error cargando buscador:", e);
    }
}

// 3. Filtrar el select 
function filtrarPersonasParaBombona() {
    const inputBusqueda = document.getElementById('busqueda-persona');
    const busqueda = inputBusqueda ? inputBusqueda.value.toLowerCase() : '';
    const select = document.getElementById('select-persona-bombona');
    
    if(!select) return;
    
    select.innerHTML = '';
    
    // Si no hay personas disponibles
    if (listaPersonasBombona.length === 0) {
        const option = document.createElement('option');
        option.textContent = "No hay personas pendientes por registro";
        select.appendChild(option);
        return;
    }

    const filtrados = listaPersonasBombona.filter(p => 
        p.cedula.toString().includes(busqueda) || 
        p.nombre.toLowerCase().includes(busqueda) ||
        p.apellido.toLowerCase().includes(busqueda)
    );

    filtrados.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id_persona;
        option.textContent = `${p.cedula} - ${p.nombre} ${p.apellido}`;
        select.appendChild(option);
    });
}


// 4. Al dar click en "Seleccionar"
function prepararFormularioRegistro() {
    const select = document.getElementById('select-persona-bombona');
    const idPersona = select.value;
    
    if(!idPersona) return alert("Por favor, selecciona una persona de la lista.");

    personaSeleccionada = listaPersonasBombona.find(p => p.id_persona == idPersona);

    if (personaSeleccionada) {
        document.getElementById('seccion-cantidades').style.display = 'block';
        
        // Limpiamos los inputs para un nuevo registro
        document.getElementById('qty-pequena').value = '';
        document.getElementById('qty-mediana').value = '';
        document.getElementById('qty-grande').value = '';
    }
}

// 5. Guardar Registro 
async function guardarNuevoRegistroBombona() {
    if (!personaSeleccionada) return alert("Debe seleccionar un usuario primero.");

    const peq = parseInt(document.getElementById('qty-pequena').value) || 0;
    const med = parseInt(document.getElementById('qty-mediana').value) || 0;
    const gra = parseInt(document.getElementById('qty-grande').value) || 0;

    if (peq === 0 && med === 0 && gra === 0) {
        return alert("Debe indicar la cantidad de al menos un tipo de cilindro.");
    }

    try {
        const response = await fetch('/bombonas/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_persona: personaSeleccionada.id_persona,
                pequeñas: peq, 
                medianas: med,
                grandes: gra
            })
        });

        if (response.ok) {
            alert('¡Inventario registrado con éxito!');
            
            // --- CONTROL DE REFRESCAMIENTO DEPENDIENDO DEL ROL ---
            const datosSesion = sessionStorage.getItem('usuario');
            const usuarioLogueado = datosSesion ? JSON.parse(datosSesion) : null;

            if (usuarioLogueado && usuarioLogueado.nombre_rol === 'Administrador') {
                // Flujo Original de recarga para el Administrador
                await cargarTablaRegistroBombonas(); 
                await cargarPersonasParaBuscadorBombonas(); 
                cargarEstadisticasCalles();
                cargarEstadisticasVentasCalles();
                if (typeof cargarEstadisticas === 'function') {
                    cargarEstadisticas();
                }
            } else {
                // Flujo Limpio de recarga para el Secretario
                await cargarTablaRegistroBombonasSecretario(); // Su nueva tabla sin pago
                if (typeof cargarPersonasParaBuscadorBombonasSecretario === 'function') {
                    await cargarPersonasParaBuscadorBombonasSecretario(); // Su buscador por calle
                }
                if (typeof cargarEstadisticasVentasCalles === 'function') {
                    cargarEstadisticasVentasCalles(); // Si el dashboard del secretario usa estadísticas
                }
            }
            // -----------------------------------------------------

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

async function cargarTablaRegistroBombonas() {
    try {
        const response = await fetch('/bombonas/registros/detallado');
        const data = await response.json();
        const tbody = document.getElementById('tabla-registro-bombonas');
        if(!tbody) return;
        
        tbody.innerHTML = '';

        data.registros.forEach(r => {
            const tr = document.createElement('tr');
            
           tr.innerHTML = `
    <td>${r.cedula}</td>
    <td>${r.nombre}</td>
    <td>${r.apellido}</td>
    <td>${r.sexo}</td>
    <td>${r.edad || "-"}</td>
    <td>${r.celular || "-"}</td>
    <!-- Celdas editables -->
    <td style="text-align: center;">
            <input type="number" class="edit-input" value="${r.bombonas_pequenas}" id="peq-${r.id_registro}">
        </td>
        <td style="text-align: center;">
            <input type="number" class="edit-input" value="${r.bombonas_medianas}" id="med-${r.id_registro}">
        </td>
        <td style="text-align: center;">
            <input type="number" class="edit-input" value="${r.bombonas_grandes}" id="gra-${r.id_registro}">
        </td>
        <td class="acciones">
            <button class="btn-update" onclick="actualizarRegistro(${r.id_registro})" title="Guardar cambios">✔️</button>
            <button class="btn-delete" onclick="eliminarRegistro(${r.id_registro})" title="Eliminar">🗑️</button>
        </td>
`;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error en tabla:", e);
    }
}
async function actualizarRegistro(id) {
    const data = {
        id_registro: id,
        pequenas: document.getElementById(`peq-${id}`).value,
        medianas: document.getElementById(`med-${id}`).value,
        grandes: document.getElementById(`gra-${id}`).value
    };

    const res = await fetch('/bombonas/actualizar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (res.ok) {
        alert("¡Cambio guardado!");
        cargarEstadisticasCalles();
        cargarEstadisticasVentasCalles();
        if (typeof cargarEstadisticas === 'function') {
            cargarEstadisticas();
        }
    }
    cargarTablaRegistroBombonas(); 
    cargarPersonasParaBuscadorBombonas();
}

// Para Eliminar (La papelera)
async function eliminarRegistro(id) {
    if (!confirm("¿Seguro que quieres borrar este registro?")) return;
    
    const res = await fetch(`/bombonas/eliminar/${id}`, { method: 'DELETE' });
    if (res.ok) {
        alert("Registro eliminado");
        cargarEstadisticasCalles();
        cargarEstadisticasVentasCalles();
        if (typeof cargarEstadisticas === 'function') {
            cargarEstadisticas();
        }
        // RECARGAMOS TODO
        await cargarTablaRegistroBombonas(); 
        await cargarPersonasParaBuscadorBombonas(); 
    }
}

async function cargarTablaParaVentas() {
    try {
        // Reutilizamos la ruta que ya trae los datos de personas con sus bombonas
        const response = await fetch('/bombonas/registros/detallado');
        const data = await response.json();
        const tbody = document.getElementById('tabla-usuarios-compras');
        if(!tbody) return;
        
        tbody.innerHTML = '';

        data.registros.forEach(r => {
            const tr = document.createElement('tr');
            
            // Formateamos la fecha de registro
            const fechaRef = r.fecha_registro ? new Date(r.fecha_registro).toLocaleDateString() : 'N/A';

            tr.innerHTML = `
                <td>${r.cedula}</td>
                <td>${r.nombre} ${r.apellido}</td>
                <td>P: ${r.bombonas_pequenas} | M: ${r.bombonas_medianas} | G: ${r.bombonas_grandes}</td>
                <td>${fechaRef}</td>
                <td>
                    <button class="btn-select" onclick="seleccionarParaCompra(${JSON.stringify(r).replace(/"/g, '&quot;')})">
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
function seleccionarParaCompra(registro) {
    // Guardamos el registro seleccionado en una variable global para usarlo al procesar la venta
    window.registroVentaActual = registro; 

    // Mostramos el nombre del cliente en el encabezado del formulario
    const clienteSpan = document.getElementById('cliente-nombre');
    if(clienteSpan) clienteSpan.textContent = `${registro.nombre} ${registro.apellido}`;

    // Mostramos el contenedor del formulario de compra
    const formCompra = document.getElementById('formulario-compra');
    if(formCompra) {
        formCompra.style.display = 'block';
        // Hacemos scroll suave hasta el formulario para que el usuario lo vea
        formCompra.scrollIntoView({ behavior: 'smooth' });
    }

    // Opcional: Limpiar los campos de entrada por si había una selección previa
    document.getElementById('v-peq').value = 0;
    document.getElementById('v-med').value = 0;
    document.getElementById('v-gra').value = 0;
    document.getElementById('v-monto').value = '';
}
async function validarYProcesarVenta() {
    // 1. Obtener los valores de los inputs
    const peq = parseInt(document.getElementById('v-peq').value) || 0;
    const med = parseInt(document.getElementById('v-med').value) || 0;
    const gra = parseInt(document.getElementById('v-gra').value) || 0;
    const monto = document.getElementById('v-monto').value;
    const metodo = document.getElementById('v-metodo').value;
    const referenciaTexto = document.getElementById('v-referencia-texto').value.trim();
    const referenciaFotoInput = document.getElementById('v-referencia-foto');
    let referenciaFoto = null;

    // Manejar subida de foto si existe
    if (referenciaFotoInput.files.length > 0) {
        const file = referenciaFotoInput.files[0];
        referenciaFoto = file.name; // En producción, esto debería ser la ruta del archivo subido
    }

    // 2. Validaciones básicas antes de enviar al servidor
    if (peq === 0 && med === 0 && gra === 0) {
        return alert("⚠️ Error: Debe ingresar al menos una cantidad de bombonas.");
    }
    if (!monto || monto <= 0) {
        return alert("⚠️ Error: Debe ingresar un monto válido.");
    }
    if ((metodo === 'Pago Móvil' || metodo === 'Transferencia') && !referenciaTexto && !referenciaFoto) {
        return alert("⚠️ Error: Para pagos electrónicos debe agregar referencia (texto o foto).");
    }

    // 3. Recuperar el registro seleccionado
    const registro = window.registroVentaActual;
    if (!registro) return alert("❌ Error: No se ha seleccionado un beneficiario.");

    // 4. Preparar datos para el servidor
    const datosVenta = {
        id_registro: registro.id_registro,
        id_persona: registro.id_persona,
        peq: peq,
        med: med,
        gra: gra,
        monto: monto,
        metodo: metodo,
        referencia_texto: referenciaTexto,
        referencia_foto: referenciaFoto
    };

    try {
        // Enviamos la petición al servidor
        const response = await fetch('/bombonas/comprar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosVenta)
        });

        const resultado = await response.json();

        if (response.ok) {
            // Caso de éxito: El servidor validó el cupo y los 7 días
            alert("✅ " + resultado.message);

            // Ocultar formulario y limpiar campos
            document.getElementById('formulario-compra').style.display = 'none';
            document.getElementById('v-peq').value = 0;
            document.getElementById('v-med').value = 0;
            document.getElementById('v-gra').value = 0;
            document.getElementById('v-monto').value = '';
            document.getElementById('v-referencia-texto').value = '';
            document.getElementById('v-referencia-foto').value = '';

            // Recargar ambas tablas para reflejar los cambios
            cargarTablaParaVentas();
            cargarHistorialVentas();
            
            // Recargar estadísticas
            cargarEstadisticasVentasCalles();
            cargarEstadisticasCalles();
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
async function cargarHistorialVentas() {
    try {
        
        const response = await fetch('/bombonas/historial-ventas');
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

            // Formateamos la fecha del pago
            const fechaPago = new Date(v.fecha_pago).toLocaleString();

            // Construir referencia
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

            
            tr.innerHTML = `
                <td>${v.nombre} ${v.apellido}</td>
                <td>${v.cant_peq}P / ${v.cant_med}M / ${v.cant_gra}G</td>
                <td>${v.monto_pagado} Bs.</td>
                <td>${v.metodo_pago}</td>
                <td>${referenciaHTML}</td>
                <td>${fechaPago}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error al cargar historial de ventas:", e);
    }
}

async function cargarEstadisticasCalles() {
    try {
        console.log("Cargando estadísticas por calle...");
        const response = await fetch('/bombonas/estadisticas-calles');
        const data = await response.json();
        console.log("Datos recibidos:", data);
        const grid = document.getElementById('estadisticas-grid');

        if(!grid) {
            console.log("No se encontró el elemento estadisticas-grid");
            return;
        }
        grid.innerHTML = '';

        if (!data.estadisticas || data.estadisticas.length === 0) {
            grid.innerHTML = '<p style="text-align:center; grid-column: span 4;">No hay datos de estadísticas por calle</p>';
            console.log("No hay estadísticas para mostrar");
            return;
        }

        console.log("Mostrando", data.estadisticas.length, "estadísticas");
        data.estadisticas.forEach(est => {
            const card = document.createElement('div');
            card.className = 'stat-card-calle';
            card.innerHTML = `
                <div class="calle-header">
                    <h3>${est.calle}</h3>
                </div>
                <div class="calle-stats">
                    <div class="stat-row">
                        <span class="stat-label">Personas:</span>
                        <span class="stat-value">${est.total_personas}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Con Registro:</span>
                        <span class="stat-value">${est.personas_con_registro}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Total Cilindros:</span>
                        <span class="stat-value highlight">${est.total_cilindros || 0}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Pequeñas:</span>
                        <span class="stat-value">${est.total_pequenas || 0}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Medianas:</span>
                        <span class="stat-value">${est.total_medianas || 0}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Grandes:</span>
                        <span class="stat-value">${est.total_grandes || 0}</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        console.error("Error al cargar estadísticas por calle:", e);
    }
}
async function cargarEstadisticasVentasCalles() {
    try {
        console.log("Cargando estadísticas de ventas por calle...");
        const response = await fetch('/bombonas/estadisticas-ventas-calles');
        const data = await response.json();
        console.log("Datos de ventas recibidos:", data);
        const grid = document.getElementById('estadisticas-ventas-grid');

        if(!grid) {
            console.log("No se encontró el elemento estadisticas-ventas-grid");
            return;
        }
        grid.innerHTML = '';

        if (!data.estadisticas || data.estadisticas.length === 0) {
            grid.innerHTML = '<p style="text-align:center; grid-column: span 4;">No hay datos de ventas por calle</p>';
            console.log("No hay estadísticas de ventas para mostrar");
            return;
        }

        data.estadisticas.forEach(est => {
            const card = document.createElement('div');
            card.className = 'stat-card-calle';
            card.innerHTML = `
                <div class="calle-header" style="background: linear-gradient(135deg, #104358 0%, #159895 100%);">
                    <h3>${est.calle}</h3>
                </div>
                <div class="calle-stats">
                    <div class="stat-row" style="border-bottom: 2px solid rgba(21, 152, 149, 0.2); margin-bottom: 0.5rem; padding-bottom: 0.5rem;">
                        <span class="stat-label" style="font-weight: bold; color: var(--primary);">Total Bombonas:</span>
                        <span class="stat-value highlight" style="font-size: 1.1rem; font-weight: bold; color: var(--primary);">${est.total_bombonas || 0}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Pequeñas:</span>
                        <span class="stat-value">${est.total_peq || 0} (${parseFloat(est.monto_peq || 0).toFixed(2)} Bs.)</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Medianas:</span>
                        <span class="stat-value">${est.total_med || 0} (${parseFloat(est.monto_med || 0).toFixed(2)} Bs.)</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Grandes:</span>
                        <span class="stat-value">${est.total_gra || 0} (${parseFloat(est.monto_gra || 0).toFixed(2)} Bs.)</span>
                    </div>
                    <div class="stat-row" style="border-top: 2px solid rgba(21, 152, 149, 0.2); margin-top: 0.5rem; padding-top: 0.5rem;">
                        <span class="stat-label" style="font-weight: bold; color: #104358;">Total Recaudado:</span>
                        <span class="stat-value highlight" style="font-size: 1.1rem; font-weight: bold; color: #104358;">${parseFloat(est.total_monto || 0).toFixed(2)} Bs.</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        console.error("Error al cargar estadísticas de ventas por calle:", e);
    }
}

// Cargas iniciales al abrir la web
window.onload = () => {
    if (typeof cargarEstadisticas === 'function') {
        cargarEstadisticas();
    }
};


function abrirModalEditar(id_persona, cedula, nombre, apellido, sexo, edad, id_estado_civil, celular, carga_familiar, calle,estatus, fecha_registro) {
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
        document.getElementById("edit-fecha").value = `${año}-${mes}-${dia}`;
    } else {
        document.getElementById("edit-fecha").value = "";
    }
    
    document.getElementById("modal-editar-persona").style.display = "block";
}
// FUNCIÓN PARA CERRAR EL MODAL
function cerrarModalEditar() {
    document.getElementById("modal-editar-persona").style.display = "none";
}

// EVENTO PARA PROCESAR EL CAMBIO EN LA BASE DE DATOS (CON VALIDACIONES)
document.getElementById("form-editar-persona").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const idPersona = document.getElementById("edit-id").value;
    
    // 1. Capturar y limpiar valores
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

    // 2. EXPRESIONES REGULARES PARA VALIDAR
    const regexSoloLetas = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/; 
    const regexSoloNumeros = /^\d+$/;                   

    // 3. EMPEZAR LAS VALIDACIONES DE CAMPOS
    if (!cedula || !nombre || !apellido || !sexo) {
        alert("Los campos Cédula, Nombre, Apellido y Sexo son obligatorios.");
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

    // 4. SI PASÓ TODAS LAS VALIDACIONES, SE CREA EL OBJETO
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
        fecha_registro: fecha_registro || null
    };

    // 5. ENVIAR AL SERVIDOR
    try {
        const response = await fetch(`/personas/${idPersona}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datosActualizados)
        });

        const result = await response.json();

        if (response.ok) {
            alert("¡Cambios guardados con éxito en el sistema!");
            cerrarModalEditar();
            cargarPersonas(); 
        } else {
            alert(result.error || "Ocurrió un error al actualizar");
        }
    } catch (error) {
        console.error("Error en la conexión:", error);
        alert("Error de red al intentar conectar con el servidor");
    }
});

async function cargarEstadisticasVentaMiCalle() {
    const contenedor = document.getElementById('grid-calles-compras-usuario');
    if (!contenedor) return; // Si no existe el contenedor en la sección actual, cancela para evitar errores.

    let cedula = null;

    try {
        // 1. Intentamos recuperar los datos directamente del almacenamiento de la sesión activa
        const sesionUsuario = sessionStorage.getItem('usuario');
        if (sesionUsuario) {
            const usuarioObj = JSON.parse(sesionUsuario);
            cedula = usuarioObj.cedula;
        }
    } catch (e) {
        console.error("Error leyendo el objeto usuario de sessionStorage:", e);
    }

    // 2. Si por algún motivo no está en la sesión, la tomamos del elemento HTML como plan de respaldo
    if (!cedula || cedula === "Cargando...") {
        const elementoCedula = document.getElementById('user-cedula');
        cedula = elementoCedula ? elementoCedula.textContent.trim() : null;
    }

    // Si aún no hay cédula disponible, abortamos la ejecución
    if (!cedula || cedula === "Cargando..." || cedula === "null" || cedula === "undefined") {
        console.warn("⚠️ No se pudo obtener la cédula del usuario activo para las estadísticas.");
        return;
    }

    console.log("📊 Consultando estadísticas de calle para la cédula:", cedula);

    try {
        const response = await fetch(`/api/usuario/ventas-calle?cedula=${cedula}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            contenedor.innerHTML = `<p style="color: var(--danger); padding: 1rem; font-weight: 500;">${errorData.error}</p>`;
            return;
        }

        const resultado = await response.json();
        const calle = resultado.calle;
        const datos = resultado.datos;

        // 3. Renderizado final utilizando las clases estructurales de tus tarjetas para que se adapte al diseño
        contenedor.innerHTML = `
            <div class="stat-card-calle" style="max-width: 450px; margin: 1.5rem auto; width: 100%; background: #ffffff; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid rgba(0, 0, 0, 0.05);">
                <div class="calle-header" style="background: linear-gradient(135deg, #159895 0%, #104358 100%); padding: 1.2rem; text-align: center; color: white;">
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 600;"><i class="fas fa-map-marker-alt"></i> Mi Comunidad: ${calle}</h3>
                </div>
                <div class="calle-stats" style="padding: 1.5rem;">
                    <div class="stat-row" style="display: flex; justify-content: space-between; padding: 0.8rem 0; border-bottom: 1px solid #f0f4f8;">
                        <span><i class="fas fa-shopping-cart" style="color: #1a5f7a; width: 20px;"></i> Total Ventas</span>
                        <strong>${datos.total_ventas || 0}</strong>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between; padding: 0.8rem 0; border-bottom: 1px solid #f0f4f8;">
                        <span><i class="fas fa-check-circle" style="color: #2ed573; width: 20px;"></i> Pagadas</span>
                        <strong style="color: #2ed573;">${datos.pagadas || 0}</strong>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between; padding: 0.8rem 0; border-bottom: 1px solid #f0f4f8;">
                        <span><i class="fas fa-clock" style="color: #f39c12; width: 20px;"></i> Pendientes</span>
                        <strong style="color: #f39c12;">${datos.pendientes || 0}</strong>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between; padding: 1rem 0 0 0; margin-top: 0.5rem; border-top: 2px dashed #f0f4f8;">
                        <span style="font-weight: 600; color: #1a5f7a;"><i class="fas fa-money-bill-wave" style="width: 20px;"></i> Total Recaudado</span>
                        <strong style="font-size: 1.25rem; color: #1a5f7a;">${datos.total_dinero ? parseFloat(datos.total_dinero).toFixed(2) : '0.00'} $</strong>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error("Error en la conexión frontend-backend:", error);
        contenedor.innerHTML = '<p style="color: var(--danger); padding: 1rem;">Error de conexión al procesar las estadísticas de la calle.</p>';
    }
}
// NUEVA FUNCIÓN EXCLUSIVA PARA EL BUSCADOR DEL SECRETARIO
async function cargarPersonasParaBuscadorBombonasSecretario() {
    try {
        // 1. Obtenemos los datos del Secretario desde el sessionStorage
        const datosSesion = sessionStorage.getItem('usuario');
        if (!datosSesion) return;

        const usuarioLogueado = JSON.parse(datosSesion);
        const cedulaSecretario = usuarioLogueado.cedula;

        if (!cedulaSecretario) {
            console.error("No se encontró la cédula del secretario logueado.");
            return;
        }

        // 2. Hacemos el fetch a la nueva ruta enviando la cédula
        const response = await fetch(`/api/secretario/personas-buscador?cedulaUsuario=${cedulaSecretario}`);
        
        if (!response.ok) {
            throw new Error("Error en la respuesta del servidor");
        }

        // 3. Guardamos los resultados filtrados en la variable global que ya usa tu buscador
        listaPersonasBombona = await response.json();
        console.log("Habitantes de la calle cargados para el buscador:", listaPersonasBombona.length);

    } catch (error) {
        console.error("Error al cargar personas del secretario para el buscador:", error);
    }
}

async function cargarTablaRegistroBombonasSecretario() {
    const tbody = document.getElementById('tabla-registro-bombonas');
    if (!tbody) {
        console.error("❌ No se encontró el elemento #tabla-registro-bombonas en el HTML.");
        return;
    }

    try {
        const datosSesion = sessionStorage.getItem('usuario');
        if (!datosSesion) return;

        const usuarioLogueado = JSON.parse(datosSesion);
        const cedulaSecretario = usuarioLogueado.cedula;

        // Petición al endpoint del servidor
        const response = await fetch(`/api/secretario/registro-bombonas?cedulaUsuario=${cedulaSecretario}`);
        const registros = await response.json();

        tbody.innerHTML = '';

        if (registros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color: var(--text-light); padding: 1rem;">No hay bombonas asignadas en su calle todavía.</td></tr>';
            return;
        }

        registros.forEach(reg => {
            const tr = document.createElement('tr');
            
            // Renderizamos las filas usando los nombres exactos que vienen de tu servidor
            tr.innerHTML = `
                <td>${reg.cedula || reg.cedula_persona}</td>
                <td>${reg.nombre}</td>
                <td>${reg.apellido}</td>
                <td style="text-align:center;">${reg.sexo || '-'}</td>
                <td style="text-align:center;">${reg.edad || '-'}</td>
                <td>${reg.celular || reg.telefono || '-'}</td>
                
                <td style="text-align:center;">
                    <input type="number" min="0" value="${reg.bombonas_pequenas || 0}" id="input-peq-${reg.id_registro}" style="width: 50px; text-align: center; border: 1px solid #ccc; border-radius: 4px; padding: 2px; font-weight: 600;">
                </td>
                <td style="text-align:center;">
                    <input type="number" min="0" value="${reg.bombonas_medianas || 0}" id="input-med-${reg.id_registro}" style="width: 50px; text-align: center; border: 1px solid #ccc; border-radius: 4px; padding: 2px; font-weight: 600;">
                </td>
                <td style="text-align:center;">
                    <input type="number" min="0" value="${reg.bombonas_grandes || 0}" id="input-gra-${reg.id_registro}" style="width: 50px; text-align: center; border: 1px solid #ccc; border-radius: 4px; padding: 2px; font-weight: 600;">
                </td>
                
                <td style="text-align:center;">
                    <div style="display: flex; gap: 12px; justify-content: center; align-items: center;">
                        <button onclick="guardarCambiosDirectosSecretario(${reg.id_registro})" title="Guardar Cambios" style="background: none; border: none; font-size: 1.3rem; cursor: pointer;">
                            ☑️
                        </button>
                        <button onclick="eliminarAsignacionCompleta('[${reg.id_registro}]')" title="Eliminar Asignación" style="background: none; border: none; font-size: 1.3rem; cursor: pointer;">
                            🗑️
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("❌ Error al cargar la tabla de bombonas del secretario:", error);
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color: var(--danger); padding: 1rem;">Error al cargar los datos del sector.</td></tr>';
    }
}

async function guardarCambiosDirectosSecretario(idRegistro) {
    const peq = parseInt(document.getElementById(`input-peq-${idRegistro}`).value) || 0;
    const med = parseInt(document.getElementById(`input-med-${idRegistro}`).value) || 0;
    const gra = parseInt(document.getElementById(`input-gra-${idRegistro}`).value) || 0;

    try {
        // Enviamos la actualización al backend
        const response = await fetch('/bombonas/actualizar-cantidades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: idRegistro,
                tamano_pequena: peq,
                tamano_mediana: med,
                tamano_grande: gra
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert("¡Cambios guardados con éxito!");
            await cargarTablaRegistroBombonasSecretario(); // Recargamos la tabla limpia
        } else {
            alert("Error: " + (result.error || "No se pudieron guardar los cambios"));
        }
    } catch (error) {
        console.error("Error al actualizar cantidades:", error);
        alert("Error de conexión con el servidor.");
    }
}
// NUEVA FUNCIÓN: Se ejecuta al presionar el emoji de la papelera 🗑️
async function eliminarAsignacionCompleta(idsArrayString) {
    if (!confirm("¿Está seguro de que desea eliminar esta asignación de bombonas?")) return;

    try {
        const ids = JSON.parse(idsArrayString);
        
        // Iteramos por los IDs asociados a este habitante para eliminarlos uno por uno de forma limpia
        for (const id of ids) {
            await fetch(`/api/registro-bombonas/${id}`, { method: 'DELETE' });
        }

        alert("Asignación eliminada correctamente.");
        await cargarTablaRegistroBombonasSecretario(); // Recargamos la tabla
        if (typeof cargarPersonasParaBuscadorBombonasSecretario === 'function') {
            await cargarPersonasParaBuscadorBombonasSecretario(); // Reaparece en el buscador superior
        }
    } catch (error) {
        console.error("Error al eliminar la asignación:", error);
        alert("Ocurrió un detalle al intentar eliminar.");
    }
}
async function eliminarAsignacionCompleta(idsArrayString) {
    if (!confirm("¿Está seguro de que desea eliminar esta asignación de bombonas?")) return;

    try {
        const ids = JSON.parse(idsArrayString);
        let todoBien = true;
        
        // Eliminamos de la BD
        for (const id of ids) {
            const response = await fetch(`/api/registro-bombonas/${id}`, { 
                method: 'DELETE' 
            });

            if (!response.ok) {
                todoBien = false;
            }
        }

        if (todoBien) {
            alert("Asignación eliminada correctamente.");
            // Recargamos la tabla del secretario para que se actualice al instante en pantalla
            await cargarTablaRegistroBombonasSecretario(); 
        } else {
            alert("⚠️ El servidor no pudo procesar la eliminación de forma completa.");
        }

    } catch (error) {
        console.error("Error al eliminar la asignación:", error);
        alert("Error de conexión al intentar eliminar el registro.");
    }
}