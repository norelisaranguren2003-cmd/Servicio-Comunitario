const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname)));

// Log de todas las peticiones POST
app.use((req, res, next) => {
    if (req.method === 'POST') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        console.log('Headers:', req.headers['content-type']);
        console.log('Body:', req.body);
    }
    next();
});

// Conexión a MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'servicio_comunitario'
});

db.connect(err => {
    if (err) {
        console.error('❌ Error al conectar a MySQL:', err.message);
        console.log('Verifica que XAMPP esté corriendo');
    } else {
        console.log('✅ Conectado a MySQL');
    }
});

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// LOGIN - Acepta usuario o cédula
app.post('/login', (req, res) => {
    console.log('--- Intento de Login ---');
    const { usuario, password, role } = req.body;

    if (!usuario || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    const query = `
        SELECT u.id_usuario, u.usuario_login, u.id_rol, r.nombre_rol,
               p.id_persona, p.cedula, p.nombre, p.apellido, p.edad, p.celular
        FROM usuarios u
        LEFT JOIN personas p ON u.id_persona = p.id_persona
        LEFT JOIN roles r ON u.id_rol = r.id_rol
        WHERE (u.usuario_login = ? OR p.cedula = ?) AND u.password_hash = ?
    `;

    db.query(query, [usuario, usuario, password], (err, results) => {
        if (err) {
            console.error('Error en login:', err);
            return res.status(500).json({ error: 'Error al verificar credenciales' });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: 'Usuario/cédula o contraseña incorrectos' });
        }

        const user = results[0];

        if (role === 'admin' && user.nombre_rol !== 'Administrador') {
            return res.status(403).json({ error: 'Acceso denegado: Las credenciales no corresponden a un administrador' });
        }

        if (role === 'user' && user.nombre_rol === 'Administrador') {
            return res.status(403).json({ error: 'Acceso denegado: Las credenciales de administrador no pueden usarse en el rol de secretario' });
        }

        res.json({ message: 'Login exitoso', usuario: user });
    });
});

// OBTENER TODAS LAS PERSONAS
app.get('/personas', (req, res) => {
    const query = `
        SELECT p.*, ec.estado_civil 
        FROM personas p
        LEFT JOIN estados_civiles ec ON p.id_estado_civil = ec.id_estado_civil
        ORDER BY p.fecha_registro DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al obtener personas' });
        res.json({ personas: results });
    });
});

// OBTENER PERSONAS SIN ASIGNACIÓN DE BOMBONAS
app.get('/personas/sin-bombonas', (req, res) => {
    const query = `
        SELECT p.id_persona, p.cedula, p.nombre, p.apellido 
        FROM personas p
        WHERE p.id_persona NOT IN (SELECT id_persona FROM registro_bombonas)
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ personas: results });
    });
});

// CREAR PERSONA
app.post('/personas', (req, res) => {
    const { cedula, nombre, apellido, sexo, edad, id_estado_civil, celular, carga_familiar, calle } = req.body;
    
    if (!cedula || !nombre || !apellido || !sexo) {
        return res.status(400).json({ error: 'Cédula, nombre, apellido y sexo son requeridos' });
    }
    
    const query = `INSERT INTO personas (cedula, nombre, apellido, sexo, edad, id_estado_civil, celular, carga_familiar, calle) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.query(query, [cedula, nombre, apellido, sexo, edad || null, id_estado_civil || 1, celular || null, carga_familiar || 0, calle || null], 
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe una persona con esa cédula' });
                return res.status(500).json({ error: 'Error al crear persona' });
            }
            res.json({ message: 'Persona creada exitosamente', id_persona: result.insertId });
        }
    );
});

// ACTUALIZAR/EDITAR PERSONA
app.put('/personas/:id_persona', (req, res) => {
    const { id_persona } = req.params;
    const { cedula, nombre, apellido, sexo, edad, id_estado_civil, celular, carga_familiar, calle, estatus, fecha_registro } = req.body;

    if (!cedula || !nombre || !apellido || !sexo) {
        return res.status(400).json({ error: 'Cédula, nombre, apellido y sexo son requeridos' });
    }

    const regexLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    const regexNumeros = /^\d+$/;

    if (!regexNumeros.test(cedula)) return res.status(400).json({ error: 'La cédula debe contener únicamente números.' });
    if (!regexLetras.test(nombre) || !regexLetras.test(apellido)) return res.status(400).json({ error: 'El nombre y el apellido solo deben contener letras.' });
    if (edad && (parseInt(edad) < 0 || parseInt(edad) > 120)) return res.status(400).json({ error: 'La edad proporcionada no es válida.' });

    const query = `
        UPDATE personas 
        SET cedula = ?, nombre = ?, apellido = ?, sexo = ?, edad = ?, id_estado_civil = ?, 
            celular = ?, carga_familiar = ?, calle = ?, estatus = ?, fecha_registro = ?
        WHERE id_persona = ?
    `;

    const valores = [cedula, nombre, apellido, sexo, edad || null, id_estado_civil || 1, celular || null, carga_familiar || 0, calle || null, estatus || 'Activo', fecha_registro, id_persona];

    db.query(query, valores, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe otra persona con esa cédula registrada' });
            return res.status(500).json({ error: 'Error al actualizar los datos' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Persona no encontrada' });
        res.json({ message: 'Persona actualizada exitosamente' });
    });
});

// CREAR USUARIO
app.post('/usuarios', (req, res) => {
    const { id_persona, id_rol, usuario_login, password } = req.body;

    if (!id_persona || !usuario_login || !password) {
        return res.status(400).json({ error: 'Persona, usuario y contraseña son requeridos' });
    }

    const query = `INSERT INTO usuarios (id_persona, id_rol, usuario_login, password_hash) VALUES (?, ?, ?, ?)`;

    db.query(query, [id_persona, id_rol || 2, usuario_login, password], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El nombre de usuario ya existe' });
            return res.status(500).json({ error: 'Error al crear usuario' });
        }
        res.json({ message: 'Usuario creado exitosamente', id_usuario: result.insertId });
    });
});

// ROLES Y ESTADOS CIVILES
app.get('/roles', (req, res) => {
    db.query('SELECT * FROM roles', (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al obtener roles' });
        res.json({ roles: results });
    });
});

app.get('/estados-civiles', (req, res) => {
    db.query('SELECT * FROM estados_civiles', (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al obtener estados civiles' });
        res.json({ estados_civiles: results });
    });
});

// OBTENER ESTADÍSTICAS DEL DASHBOARD GLOBAL (ADMIN)
app.get('/stats', (req, res) => {
    const queries = {
        total_personas: 'SELECT COUNT(*) as count FROM personas',
        total_admins: 'SELECT COUNT(*) as count FROM usuarios WHERE id_rol = 1',
        total_secretarios: 'SELECT COUNT(*) as count FROM usuarios WHERE id_rol = 2'
    };

    const stats = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;

    Object.keys(queries).forEach(key => {
        db.query(queries[key], (err, results) => {
            if (err) stats[key] = 0;
            else stats[key] = results[0].count;
            
            completed++;
            if (completed === totalQueries) res.json(stats);
        });
    });
});

// OBTENER TOTALES GENERALES DE CILINDROS
app.get('/bombonas/totales', (req, res) => {
    const query = `
        SELECT 
            SUM(bombonas_pequenas) as total_pequenas,
            SUM(bombonas_medianas) as total_medianas,
            SUM(bombonas_grandes) as total_grandes
        FROM registro_bombonas
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al calcular totales' });
        res.json(results[0] || { total_pequenas: 0, total_medianas: 0, total_grandes: 0 });
    });
});

// REGISTRAR ASIGNACIÓN DE BOMBONAS (ADMIN Y SECRETARIO)
app.post('/bombonas/registrar', (req, res) => {
    const { id_persona, pequeñas, medianas, grandes } = req.body; // Mapeado flexible para soportar tildes de la vista

    if (!id_persona) return res.status(400).json({ error: 'Persona no seleccionada' });

    const queryInsert = `INSERT INTO registro_bombonas (id_persona, bombonas_pequenas, bombonas_medianas, bombonas_grandes) VALUES (?, ?, ?, ?)`;
    
    db.query(queryInsert, [id_persona, pequeñas || 0, medianas || 0, grandes || 0], (errInsert) => {
        if (errInsert) return res.status(500).json({ error: 'Error al insertar: ' + errInsert.message });
        res.json({ message: '¡Inventario registrado con éxito!' });
    });
});

// OBTENER TABLA DETALLADA (ADMIN)
app.get('/bombonas/registros/detallado', (req, res) => {
    const query = `
        SELECT p.cedula, p.nombre, p.apellido, p.sexo, p.edad, p.celular, rb.id_registro,
               rb.bombonas_pequenas, rb.bombonas_medianas, rb.bombonas_grandes, rb.fecha_actualizacion as fecha_registro
        FROM registro_bombonas rb
        JOIN personas p ON rb.id_persona = p.id_persona
        ORDER BY rb.fecha_actualizacion DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al obtener tabla' });
        res.json({ registros: results });
    });
});

// ACTUALIZAR ASIGNACIÓN DESDE LA TABLA (ADMIN)
app.put('/bombonas/actualizar', (req, res) => {
    const { id_registro, pequenas, medianas, grandes } = req.body;
    const query = `UPDATE registro_bombonas SET bombonas_pequenas=?, bombonas_medianas=?, bombonas_grandes=? WHERE id_registro=?`;
    db.query(query, [pequenas, medianas, grandes, id_registro], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ status: "ok" });
    });
});

// ELIMINAR ASIGNACIÓN COMPLETAMENTE
app.delete('/bombonas/eliminar/:id', (req, res) => {
    const query = `DELETE FROM registro_bombonas WHERE id_registro = ?`;
    db.query(query, [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ status: "ok" });
    });
});

// PROCESAR COMPRA Y PAGO DE GAS
app.post('/bombonas/comprar', (req, res) => {
    const { id_registro, peq, med, gra, monto, metodo, referencia_texto, referencia_foto } = req.body;

    const queryCheck = `
        SELECT 
            rb.bombonas_pequenas, rb.bombonas_medianas, rb.bombonas_grandes,
            (SELECT SUM(h.cant_peq) FROM pagos_bombonas h WHERE h.id_registro = rb.id_registro AND h.fecha_pago > DATE_SUB(NOW(), INTERVAL 7 DAY)) as compradas_peq,
            (SELECT SUM(h.cant_med) FROM pagos_bombonas h WHERE h.id_registro = rb.id_registro AND h.fecha_pago > DATE_SUB(NOW(), INTERVAL 7 DAY)) as compradas_med,
            (SELECT SUM(h.cant_gra) FROM pagos_bombonas h WHERE h.id_registro = rb.id_registro AND h.fecha_pago > DATE_SUB(NOW(), INTERVAL 7 DAY)) as compradas_gra
        FROM registro_bombonas rb 
        WHERE rb.id_registro = ?`;
    
    db.query(queryCheck, [id_registro], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ error: "Error al validar el registro de bombonas" });

        const data = results[0];
        const dispPeq = data.bombonas_pequenas - (data.compradas_peq || 0);
        const dispMed = data.bombonas_medianas - (data.compradas_med || 0);
        const dispGra = data.bombonas_grandes - (data.compradas_gra || 0);

        if (peq > 0 && dispPeq <= 0) return res.status(400).json({ error: "Ya compró sus bombonas pequeñas." });
        if (med > 0 && dispMed <= 0) return res.status(400).json({ error: "Ya compró sus bombonas medianas." });
        if (gra > 0 && dispGra <= 0) return res.status(400).json({ error: "Ya compró sus bombonas grandes." });

        if (peq > dispPeq) return res.status(400).json({ error: `Solo tiene ${dispPeq} bombona(s) registrada(s) de tamaño pequeño.` });
        if (med > dispMed) return res.status(400).json({ error: `Solo tiene ${dispMed} bombona(s) registrada(s) de tamaño mediano.` });
        if (gra > dispGra) return res.status(400).json({ error: `Solo tiene ${dispGra} bombona(s) registrada(s) de tamaño grande.` });

        const queryPago = `INSERT INTO pagos_bombonas (id_registro, monto_pagado, metodo_pago, cant_peq, cant_med, cant_gra, referencia_texto, referencia_foto) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        
        db.query(queryPago, [id_registro, monto, metodo, peq, med, gra, referencia_texto || null, referencia_foto || null], (errPago) => {
            if (errPago) return res.status(500).json({ error: "Error al registrar el pago: " + errPago.message });
            res.json({ message: "¡Compra procesada con éxito!" });
        });
    });
});

// HISTORIAL GENERAL DE VENTAS
app.get('/bombonas/historial-ventas', (req, res) => {
    const query = `
        SELECT p.nombre, p.apellido, pb.monto_pagado, pb.metodo_pago, pb.fecha_pago,
               pb.cant_peq, pb.cant_med, pb.cant_gra, pb.referencia_texto, pb.referencia_foto
        FROM pagos_bombonas pb
        JOIN registro_bombonas rb ON pb.id_registro = rb.id_registro
        JOIN personas p ON rb.id_persona = p.id_persona
        ORDER BY pb.fecha_pago DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al obtener historial' });
        res.json({ historial: results });
    });
});

// ESTADÍSTICAS GLOBALES POR CALLE (ADMIN)
app.get('/bombonas/estadisticas-calles', (req, res) => {
    const query = `
        SELECT 
            p.calle,
            COUNT(DISTINCT p.id_persona) as total_personas,
            COUNT(DISTINCT CASE WHEN rb.id_registro IS NOT NULL THEN p.id_persona END) as personas_con_registro,
            SUM(COALESCE(rb.bombonas_pequenas, 0)) as total_pequenas,
            SUM(COALESCE(rb.bombonas_medianas, 0)) as total_medianas,
            SUM(COALESCE(rb.bombonas_grandes, 0)) as total_grandes,
            SUM(COALESCE(rb.bombonas_pequenas, 0) + COALESCE(rb.bombonas_medianas, 0) + COALESCE(rb.bombonas_grandes, 0)) as total_cilindros
        FROM personas p
        LEFT JOIN registro_bombonas rb ON p.id_persona = rb.id_persona
        GROUP BY p.calle
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al obtener estadísticas por calle' });

        const calles = ['Calle 1', 'Calle 2', 'Calle 3', 'Calle 4', 'Calle 5', 'Calle 6', 'Calle 7', 'Callejón'];
        const estadisticasCompletas = calles.map(calle => {
            const encontrado = results.find(r => r.calle === calle);
            return encontrado || { calle, total_personas: 0, personas_con_registro: 0, total_pequenas: 0, total_medianas: 0, total_grandes: 0, total_cilindros: 0 };
        });
        res.json({ estadisticas: estadisticasCompletas });
    });
});

// ESTADÍSTICAS DE RECAUDACIÓN Y VENTAS POR CALLE
app.get('/bombonas/estadisticas-ventas-calles', (req, res) => {
    const query = `
        SELECT p.calle, pb.cant_peq, pb.cant_med, pb.cant_gra, pb.monto_pagado
        FROM pagos_bombonas pb
        JOIN registro_bombonas rb ON pb.id_registro = rb.id_registro
        JOIN personas p ON rb.id_persona = p.id_persona
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error al obtener estadísticas de ventas' });

        const calles = ['Calle 1', 'Calle 2', 'Calle 3', 'Calle 4', 'Calle 5', 'Calle 6', 'Calle 7', 'Callejón'];
        const statsMap = {};
        calles.forEach(calle => {
            statsMap[calle] = { calle, total_peq: 0, total_med: 0, total_gra: 0, total_bombonas: 0, monto_peq: 0, monto_med: 0, monto_gra: 0, total_monto: 0 };
        });

        results.forEach(row => {
            const calle = row.calle;
            if (!statsMap[calle]) return;

            const peq = parseInt(row.cant_peq) || 0;
            const med = parseInt(row.cant_med) || 0;
            const gra = parseInt(row.cant_gra) || 0;
            const totalCils = peq + med + gra;
            const monto = parseFloat(row.monto_pagado) || 0;

            statsMap[calle].total_peq += peq;
            statsMap[calle].total_med += med;
            statsMap[calle].total_gra += gra;
            statsMap[calle].total_bombonas += totalCils;
            statsMap[calle].total_monto += monto;

            if (totalCils > 0) {
                statsMap[calle].monto_peq += monto * (peq / totalCils);
                statsMap[calle].monto_med += monto * (med / totalCils);
                statsMap[calle].monto_gra += monto * (gra / totalCils);
            }
        });

        res.json({ estadisticas: calles.map(calle => statsMap[calle]) });
    });
});

// --- SECCIÓN CORREGIDA: ENPOINTS EXCLUSIVOS DEL LÍDER DE CALLE / SECRETARIO ---

// 1. BALANCE GENERAL DE LA CALLE DEL SECRETARIO
app.get('/api/usuario/ventas-calle', (req, res) => {
    const cedulaUsuario = req.query.cedula;

    if (!cedulaUsuario || cedulaUsuario === 'undefined' || cedulaUsuario === 'null') {
        return res.status(400).json({ error: "Cédula de usuario no válida o ausente" });
    }

    const queryCalle = `SELECT calle FROM personas WHERE cedula = ?`;

    db.query(queryCalle, [cedulaUsuario], (err, resultados) => {
        if (err) return res.status(500).json({ error: "Error interno en la base de datos" });
        if (resultados.length === 0 || !resultados[0].calle) {
            return res.status(404).json({ error: "El usuario no tiene una calle asignada en el sistema" });
        }

        const miCalle = resultados[0].calle;
        
        const queryStatsCalle = `
            SELECT 
                COUNT(rb.id_registro) as total_ventas,
                SUM(CASE WHEN pb.id_pago IS NOT NULL THEN 1 ELSE 0 END) as pagadas,
                SUM(CASE WHEN pb.id_pago IS NULL THEN 1 ELSE 0 END) as pendientes,
                SUM(IFNULL(pb.monto_pagado, 0)) as total_dinero
            FROM personas p
            LEFT JOIN registro_bombonas rb ON p.id_persona = rb.id_persona
            LEFT JOIN pagos_bombonas pb ON rb.id_registro = pb.id_registro
            WHERE p.calle = ?
        `;

        db.query(queryStatsCalle, [miCalle], (errVentas, stats) => {
            if (errVentas) return res.status(500).json({ error: "Error al calcular el balance financiero de la calle" });
            res.json({ calle: miCalle, datos: stats[0] });
        });
    });
});

// 2. BUSCADOR FILTRADO POR LA CALLE DEL SECRETARIO (Excluye ya registrados)
app.get('/api/secretario/personas-buscador', (req, res) => {
    const { cedulaUsuario } = req.query;

    if (!cedulaUsuario) return res.status(400).json({ error: "Falta la cédula del secretario" });

    const queryCalle = 'SELECT calle FROM personas WHERE cedula = ?';
    db.query(queryCalle, [cedulaUsuario], (err, personas) => {
        if (err) return res.status(500).json({ error: "Error interno en el servidor" });
        if (personas.length === 0 || !personas[0].calle) return res.json([]);

        const miCalle = personas[0].calle;

        const queryFiltrado = `
            SELECT id_persona, cedula, nombre, apellido, celular, calle FROM personas 
            WHERE calle = ? AND id_persona NOT IN (SELECT id_persona FROM registro_bombonas)
        `;
        
        db.query(queryFiltrado, [miCalle], (errFiltrado, resultados) => {
            if (errFiltrado) return res.status(500).json({ error: "Error al filtrar los habitantes" });
            return res.json(resultados);
        });
    });
});

// 3. TABLA DE ASIGNACIONES FILTRADA POR LA CALLE DEL SECRETARIO (NOMBRES DE COLUMNA CORREGIDOS)
app.get('/api/secretario/registro-bombonas', (req, res) => {
    const { cedulaUsuario } = req.query;

    if (!cedulaUsuario) return res.status(400).json({ error: "Falta la cédula del secretario" });

    const queryCalle = 'SELECT calle FROM personas WHERE cedula = ?';
    db.query(queryCalle, [cedulaUsuario], (err, personas) => {
        if (err) return res.status(500).json({ error: "Error interno en el servidor" });
        if (personas.length === 0 || !personas[0].calle) return res.json([]);

        const miCalle = personas[0].calle;

        // Cambiado de registros_bombonas -> registro_bombonas y tamano_xxx -> bombonas_xxx
        const queryRegistros = `
            SELECT 
                rb.id_registro,
                rb.id_persona,
                p.cedula as cedula_persona,
                rb.bombonas_pequenas, 
                rb.bombonas_medianas, 
                rb.bombonas_grandes, 
                rb.fecha_actualizacion as fecha,
                p.nombre, 
                p.apellido, 
                p.sexo, 
                p.edad, 
                p.celular
            FROM registro_bombonas rb
            INNER JOIN personas p ON rb.id_persona = p.id_persona
            WHERE p.calle = ?
            ORDER BY rb.fecha_actualizacion DESC
        `;

        db.query(queryRegistros, [miCalle], (errReg, resultados) => {
            if (errReg) {
                console.error("❌ Error SQL Ejecutado en secretario:", errReg);
                return res.status(500).json({ error: "Error al cargar la lista de asignaciones de su calle" });
            }
            return res.json(resultados);
        });
    });
});

// 4. ACTUALIZAR CANTIDADES DESDE LOS INPUTS DEL SECRETARIO (CORREGIDO)
app.post('/bombonas/actualizar-cantidades', (req, res) => {
    const { id, tamano_pequena, tamano_mediana, tamano_grande } = req.body;

    if (!id) return res.status(400).json({ error: "Falta el ID del registro" });

    // Cambiado para que coincida con la tabla unificada registro_bombonas
    const queryUpdate = `
        UPDATE registro_bombonas 
        SET bombonas_pequenas = ?, bombonas_medianas = ?, bombonas_grandes = ? 
        WHERE id_registro = ?
    `;

    db.query(queryUpdate, [tamano_pequena, tamano_mediana, tamano_grande, id], (err) => {
        if (err) return res.status(500).json({ error: "Error en la base de datos al actualizar cantidades" });
        return res.json({ mensaje: "Cantidades actualizadas exitosamente" });
    });
});

// ELIMINAR ASIGNACIÓN DE BOMBONAS DE LA BASE DE DATOS
app.delete('/api/registro-bombonas/:id', (req, res) => {
    const idRegistro = req.params.id;

    // Usamos el nombre exacto de tu columna clave: id_registro
    const queryDelete = "DELETE FROM registro_bombonas WHERE id_registro = ?";
    
    db.query(queryDelete, [idRegistro], (err, result) => {
        if (err) {
            console.error("❌ Error SQL al intentar eliminar el registro:", err);
            return res.status(500).json({ error: "Error interno al eliminar de la base de datos" });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "No se encontró el registro para eliminar" });
        }

        console.log(`✅ Registro con ID_REGISTRO ${idRegistro} eliminado con éxito.`);
        return res.json({ message: "Registro eliminado correctamente" });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});