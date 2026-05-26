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
        if (id === 'registro-bombonas') {
            cargarPersonasParaBuscadorBombonas();
            cargarTablaRegistroBombonas();

            const secCant = document.getElementById('seccion-cantidades');
            if(secCant) secCant.style.display = 'none';
        }
        if (id === 'gestion-compras-modulo') {
            cargarTablaParaVentas();
            document.getElementById('formulario-compra').style.display = 'none';
        }
        if (id === 'gestionar_bombonas') {
            cargarTablaParaVentas();
            cargarHistorialVentas();
            cargarEstadisticasVentasCalles();
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
    pequenas: peq, 
    medianas: med,
    grandes: gra
})
        });

        if (response.ok) {
            alert('¡Inventario registrado con éxito!');
            await cargarTablaRegistroBombonas(); 
            await cargarPersonasParaBuscadorBombonas(); 
            cargarEstadisticasCalles();
            cargarEstadisticasVentasCalles();
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