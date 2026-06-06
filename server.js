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
    console.log('Body:', req.body);

    const { usuario, password, role } = req.body;

    if (!usuario || !password) {
        console.log('❌ Error: Datos faltantes en el body');
        return res.status(400).json({
            error: 'Usuario y contraseña son requeridos',
            debug: {
                recibido: req.body,
                contentType: req.headers['content-type']
            }
        });
    }

    console.log('Buscando usuario:', usuario);

    // Buscar por usuario_login O por cédula (agregando calle para guardar en sesión)
    const query = `
        SELECT u.id_usuario, u.usuario_login, u.id_rol, r.nombre_rol,
               p.id_persona, p.cedula, p.nombre, p.apellido, p.edad, p.celular, p.calle
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

        console.log('Usuario encontrado:', user.nombre_rol, 'Rol seleccionado:', role);

        // Validación: Verificar que el rol seleccionado coincida con el rol real del usuario
        if (role === 'admin' && user.nombre_rol !== 'Administrador') {
            console.log('❌ Validación fallida: Seleccionó admin pero no es admin');
            return res.status(403).json({ error: 'Acceso denegado: Las credenciales no corresponden a un administrador' });
        }

        if (role === 'user' && user.nombre_rol === 'Administrador') {
            console.log('❌ Validación fallida: Seleccionó secretario pero es admin');
            return res.status(403).json({ error: 'Acceso denegado: Las credenciales de administrador no pueden usarse en el rol de secretario' });
        }

        console.log('✅ Validación exitosa');
        res.json({
            message: 'Login exitoso',
            usuario: user
        });
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
        if (err) {
            
            return res.status(500).json({ error: 'Error al obtener personas' });
        }
        res.json({ personas: results });
    });
});
app.get('/personas/sin-bombonas', (req, res) => {
    const { calle } = req.query;
    let query = `
        SELECT p.id_persona, p.cedula, p.nombre, p.apellido, p.calle 
        FROM personas p
        WHERE p.id_persona NOT IN (SELECT id_persona FROM registro_bombonas)
    `;
    const params = [];
    if (calle && calle !== 'null' && calle !== 'undefined') {
        query += ` AND p.calle = ?`;
        params.push(calle);
    }
    db.query(query, params, (err, results) => {
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
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Ya existe una persona con esa cédula' });
                }
                console.error('Error al crear persona:', err);
                return res.status(500).json({ error: 'Error al crear persona' });
            }
            res.json({ message: 'Usuario registrado correctamente en el sistema.', id_persona: result.insertId });
        }
    );
});

// ACTUALIZAR/EDITAR PERSONA
app.put('/personas/:id_persona', (req, res) => {
    const { id_persona } = req.params;
    const { cedula, nombre, apellido, sexo, edad, id_estado_civil, celular, carga_familiar, calle,estatus, fecha_registro } = req.body;

    // 1. Validar campos obligatorios
    if (!cedula || !nombre || !apellido || !sexo) {
        return res.status(400).json({ error: 'Cédula, nombre, apellido y sexo son requeridos' });
    }

    // 2. Expresiones regulares de backend
    const regexLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    const regexNumeros = /^\d+$/;

    if (!regexNumeros.test(cedula)) {
        return res.status(400).json({ error: 'La cédula debe contener únicamente números.' });
    }

    if (!regexLetras.test(nombre) || !regexLetras.test(apellido)) {
        return res.status(400).json({ error: 'El nombre y el apellido solo deben contener letras.' });
    }

    if (edad && (parseInt(edad) < 0 || parseInt(edad) > 120)) {
        return res.status(400).json({ error: 'La edad proporcionada no es válida.' });
    }

    // 3. Ejecutar actualización si todo está bien
    const query = `
        UPDATE personas 
        SET cedula = ?, 
            nombre = ?, 
            apellido = ?, 
            sexo = ?, 
            edad = ?, 
            id_estado_civil = ?, 
            celular = ?, 
            carga_familiar = ?, 
            calle = ?,
            estatus = ?,
            fecha_registro = ?
        WHERE id_persona = ?
    `;

    const valores = [
        cedula, 
        nombre, 
        apellido, 
        sexo, 
        edad || null, 
        id_estado_civil || 1, 
        celular || null, 
        carga_familiar || 0, 
        calle || null, 
        estatus || 'Activo',
        fecha_registro,
        id_persona
    ];

    db.query(query, valores, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Ya existe otra persona con esa cédula registrada' });
            }
            console.error('Error al actualizar persona:', err);
            return res.status(500).json({ error: 'Error al actualizar los datos en la base de datos' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Persona no encontrada' });
        }

        res.json({ message: 'Persona actualizada exitosamente' });
    });
});

// CREAR USUARIO
app.post('/usuarios', (req, res) => {
    const { id_persona, id_rol, usuario_login, password } = req.body;

    if (!id_persona || !usuario_login || !password) {
        return res.status(400).json({ error: 'Persona, usuario y contraseña son requeridos' });
    }

    const query = `INSERT INTO usuarios (id_persona, id_rol, usuario_login, password_hash) 
                   VALUES (?, ?, ?, ?)`;

    db.query(query, [id_persona, id_rol || 2, usuario_login, password], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'El nombre de usuario ya existe' });
            }
            console.error('Error al crear usuario:', err);
            return res.status(500).json({ error: 'Error al crear usuario' });
        }
        res.json({ message: 'Usuario creado exitosamente', id_usuario: result.insertId });
    });
});

// OBTENER ROLES
app.get('/roles', (req, res) => {
    db.query('SELECT * FROM roles', (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener roles' });
        }
        res.json({ roles: results });
    });
});

// OBTENER ESTADOS CIVILES
app.get('/estados-civiles', (req, res) => {
    db.query('SELECT * FROM estados_civiles', (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener estados civiles' });
        }
        res.json({ estados_civiles: results });
    });
});

// OBTENER ESTADÍSTICAS DEL DASHBOARD
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
            if (err) {
                console.error(`Error en query ${key}:`, err);
                stats[key] = 0;
            } else {
                stats[key] = results[0].count;
            }
            
            completed++;
            if (completed === totalQueries) {
                res.json(stats);
            }
        });
    });
});

// OBTENER TOTALES DE BOMBONAS
app.get('/bombonas/totales', (req, res) => {
    const query = `
        SELECT 
            SUM(bombonas_10kg) as total_10kg,
            SUM(bombonas_18kg) as total_18kg,
            SUM(bombonas_27kg) as total_27kg,
            SUM(bombonas_43kg) as total_43kg
        FROM registro_bombonas
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error en totales:", err);
            return res.status(500).json({ error: 'Error al calcular totales' });
        }
        res.json(results[0] || { total_10kg: 0, total_18kg: 0, total_27kg: 0, total_43kg: 0 });
    });
});

// REGISTRAR BOMBONAS

app.post('/bombonas/registrar', (req, res) => {
    const { id_persona, bombonas_10kg, bombonas_18kg, bombonas_27kg, bombonas_43kg } = req.body;

    if (!id_persona) return res.status(400).json({ error: 'Persona no seleccionada' });

    const queryInsert = `INSERT INTO registro_bombonas (id_persona, bombonas_10kg, bombonas_18kg, bombonas_27kg, bombonas_43kg) VALUES (?, ?, ?, ?, ?)`;
    
    db.query(queryInsert, [id_persona, bombonas_10kg || 0, bombonas_18kg || 0, bombonas_27kg || 0, bombonas_43kg || 0], (errInsert, resultInsert) => {
        if (errInsert) {
            console.error('Error SQL al insertar:', errInsert);
            return res.status(500).json({ error: 'Error al insertar: ' + errInsert.message });
        }
        res.json({ message: '¡Inventario registrado con éxito!' });
    });
});


// OBTENER TABLA DETALLADA (Con soporte para filtrar por calle)
app.get('/bombonas/registros/detallado', (req, res) => {
    const { calle } = req.query;
    let query = `
        SELECT p.cedula, p.nombre, p.apellido, p.sexo, p.edad, p.celular, rb.id_registro, p.calle,
               rb.bombonas_10kg, rb.bombonas_18kg, rb.bombonas_27kg, rb.bombonas_43kg, rb.fecha_actualizacion as fecha_registro
        FROM registro_bombonas rb
        JOIN personas p ON rb.id_persona = p.id_persona
    `;
    const params = [];
    if (calle && calle !== 'null' && calle !== 'undefined') {
        query += ` WHERE p.calle = ?`;
        params.push(calle);
    }
    query += ` ORDER BY rb.fecha_actualizacion DESC`;

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Error en tabla detallada:', err);
            return res.status(500).json({ error: 'Error al obtener tabla' });
        }
        res.json({ registros: results });
    });
});
// RUTA PARA ACTUALIZAR
app.put('/bombonas/actualizar', (req, res) => {
    const { id_registro, bombonas_10kg, bombonas_18kg, bombonas_27kg, bombonas_43kg } = req.body;
    const query = `UPDATE registro_bombonas SET bombonas_10kg=?, bombonas_18kg=?, bombonas_27kg=?, bombonas_43kg=? WHERE id_registro=?`;
    db.query(query, [bombonas_10kg, bombonas_18kg, bombonas_27kg, bombonas_43kg, id_registro], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ status: "ok" });
    });
});

// RUTA PARA ELIMINAR
app.delete('/bombonas/eliminar/:id', (req, res) => {
    const query = `DELETE FROM registro_bombonas WHERE id_registro = ?`;
    db.query(query, [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ status: "ok" });
    });
});
// RUTA PARA REGISTRAR COMPRA Y PAGO
app.post('/bombonas/comprar', (req, res) => {
    const { id_registro, id_persona, qty10, qty18, qty27, qty43, monto, metodo, referencia_texto, referencia_foto } = req.body;

    const queryCheck = `
        SELECT 
            rb.bombonas_10kg, rb.bombonas_18kg, rb.bombonas_27kg, rb.bombonas_43kg,
            (SELECT SUM(h.cant_10kg) FROM pagos_bombonas h WHERE h.id_registro = rb.id_registro AND h.fecha_pago > DATE_SUB(NOW(), INTERVAL 7 DAY)) as compradas_10kg,
            (SELECT SUM(h.cant_18kg) FROM pagos_bombonas h WHERE h.id_registro = rb.id_registro AND h.fecha_pago > DATE_SUB(NOW(), INTERVAL 7 DAY)) as compradas_18kg,
            (SELECT SUM(h.cant_27kg) FROM pagos_bombonas h WHERE h.id_registro = rb.id_registro AND h.fecha_pago > DATE_SUB(NOW(), INTERVAL 7 DAY)) as compradas_27kg,
            (SELECT SUM(h.cant_43kg) FROM pagos_bombonas h WHERE h.id_registro = rb.id_registro AND h.fecha_pago > DATE_SUB(NOW(), INTERVAL 7 DAY)) as compradas_43kg
        FROM registro_bombonas rb 
        WHERE rb.id_registro = ?`;
    
    db.query(queryCheck, [id_registro], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ error: "Error al validar registro" });

        const data = results[0];
        const disp10 = data.bombonas_10kg - (data.compradas_10kg || 0);
        const disp18 = data.bombonas_18kg - (data.compradas_18kg || 0);
        const disp27 = data.bombonas_27kg - (data.compradas_27kg || 0);
        const disp43 = data.bombonas_43kg - (data.compradas_43kg || 0);

        // 1. Validaciones de disponibilidad (Bloqueo si ya no quedan)
        if (qty10 > 0 && disp10 <= 0) return res.status(400).json({ error: "Ya compró sus bombonas de 10kg." });
        if (qty18 > 0 && disp18 <= 0) return res.status(400).json({ error: "Ya compró sus bombonas de 18kg." });
        if (qty27 > 0 && disp27 <= 0) return res.status(400).json({ error: "Ya compró sus bombonas de 27kg." });
        if (qty43 > 0 && disp43 <= 0) return res.status(400).json({ error: "Ya compró sus bombonas de 43kg." });

        // 2. Validaciones con mensajes dinámicos (Singular / Plural)
        if (qty10 > disp10) {
            const msg = disp10 === 1 ? "una sola bombona registrada" : `${disp10} bombonas registradas`;
            return res.status(400).json({ error: `Solo tiene ${msg} de tamaño 10kg.` });
        }
        
        if (qty18 > disp18) {
            const msg = disp18 === 1 ? "una sola bombona registrada" : `${disp18} bombonas registradas`;
            return res.status(400).json({ error: `Solo tiene ${msg} de tamaño 18kg.` });
        }

        if (qty27 > disp27) {
            const msg = disp27 === 1 ? "una sola bombona registrada" : `${disp27} bombonas registradas`;
            return res.status(400).json({ error: `Solo tiene ${msg} de tamaño 27kg.` });
        }

        if (qty43 > disp43) {
            const msg = disp43 === 1 ? "una sola bombona registrada" : `${disp43} bombonas registradas`;
            return res.status(400).json({ error: `Solo tiene ${msg} de tamaño 43kg.` });
        }

        // 3. Verificar si inicia un nuevo lote de ventas (sin compras en los últimos 15 días)
        const periodoLoteDias = 15;
        const queryLote = `SELECT COUNT(*) as total FROM pagos_bombonas WHERE fecha_pago > DATE_SUB(NOW(), INTERVAL ? DAY)`;

        db.query(queryLote, [periodoLoteDias], (errLote, loteResults) => {
            if (errLote) return res.status(500).json({ error: "Error al verificar lote de ventas" });

            const esNuevoLote = (loteResults[0].total || 0) === 0;

            const queryPago = `INSERT INTO pagos_bombonas (id_registro, monto_pagado, metodo_pago, cant_10kg, cant_18kg, cant_27kg, cant_43kg, referencia_texto, referencia_foto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            db.query(queryPago, [id_registro, monto, metodo, qty10, qty18, qty27, qty43, referencia_texto || null, referencia_foto || null], (errPago) => {
                if (errPago) return res.status(500).json({ error: "Error al registrar el pago: " + errPago.message });
                res.json({
                    message: "¡Compra procesada con éxito!",
                    actualizar_estadisticas: esNuevoLote,
                    periodo_lote_dias: periodoLoteDias
                });
            });
        });
    });
});
// RUTA PARA OBTENER EL HISTORIAL DE VENTAS REALES (Con soporte para filtrar por calle)
app.get('/bombonas/historial-ventas', (req, res) => {
    const { calle } = req.query;
    let query = `
        SELECT p.nombre, p.apellido, pb.monto_pagado, pb.metodo_pago, pb.fecha_pago, p.calle,
               pb.cant_10kg, pb.cant_18kg, pb.cant_27kg, pb.cant_43kg, pb.referencia_texto, pb.referencia_foto
        FROM pagos_bombonas pb
        JOIN registro_bombonas rb ON pb.id_registro = rb.id_registro
        JOIN personas p ON rb.id_persona = p.id_persona
    `;
    const params = [];
    if (calle && calle !== 'null' && calle !== 'undefined') {
        query += ` WHERE p.calle = ?`;
        params.push(calle);
    }
    query += ` ORDER BY pb.fecha_pago DESC`;

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Error al obtener historial:', err);
            return res.status(500).json({ error: 'Error al obtener historial' });
        }
        res.json({ historial: results });
    });
});

// RUTA PARA OBTENER ESTADÍSTICAS POR CALLE (Actualizado a 10kg, 18kg, 27kg, 43kg)
app.get('/bombonas/estadisticas-calles', (req, res) => {
    const query = `
        SELECT 
            p.calle,
            COUNT(DISTINCT p.id_persona) as total_personas,
            COUNT(DISTINCT CASE WHEN rb.id_registro IS NOT NULL THEN p.id_persona END) as personas_con_registro,
            SUM(COALESCE(rb.bombonas_10kg, 0)) as total_10kg,
            SUM(COALESCE(rb.bombonas_18kg, 0)) as total_18kg,
            SUM(COALESCE(rb.bombonas_27kg, 0)) as total_27kg,
            SUM(COALESCE(rb.bombonas_43kg, 0)) as total_43kg,
            SUM(COALESCE(rb.bombonas_10kg, 0) + COALESCE(rb.bombonas_18kg, 0) + COALESCE(rb.bombonas_27kg, 0) + COALESCE(rb.bombonas_43kg, 0)) as total_cilindros
        FROM personas p
        LEFT JOIN registro_bombonas rb ON p.id_persona = rb.id_persona
        GROUP BY p.calle
        ORDER BY FIELD(p.calle, 'Calle 1', 'Calle 2', 'Calle 3', 'Calle 4', 'Calle 5', 'Calle 6', 'Calle 7', 'Callejón', NULL)
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener estadísticas por calle:', err);
            return res.status(500).json({ error: 'Error al obtener estadísticas por calle' });
        }

        const calles = ['Calle 1', 'Calle 2', 'Calle 3', 'Calle 4', 'Calle 5', 'Calle 6', 'Calle 7', 'Callejón'];
        const estadisticasCompletas = calles.map(calle => {
            const encontrado = results.find(r => r.calle === calle);
            if (encontrado) {
                return encontrado;
            }
            return {
                calle: calle,
                total_personas: 0,
                personas_con_registro: 0,
                total_10kg: 0,
                total_18kg: 0,
                total_27kg: 0,
                total_43kg: 0,
                total_cilindros: 0
            };
        });

        res.json({ estadisticas: estadisticasCompletas });
    });
});

// RUTA PARA OBTENER ESTADÍSTICAS DE VENTAS POR CALLE (últimos 15 días, con soporte para filtrar una sola calle)
app.get('/bombonas/estadisticas-ventas-calles', (req, res) => {
    const { calle } = req.query;
    const periodoDias = 15;
    let query = `
        SELECT 
            p.calle,
            pb.cant_10kg,
            pb.cant_18kg,
            pb.cant_27kg,
            pb.cant_43kg,
            pb.monto_pagado
        FROM pagos_bombonas pb
        JOIN registro_bombonas rb ON pb.id_registro = rb.id_registro
        JOIN personas p ON rb.id_persona = p.id_persona
        WHERE pb.fecha_pago > DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    const params = [periodoDias];
    if (calle && calle !== 'null' && calle !== 'undefined') {
        query += ` AND p.calle = ?`;
        params.push(calle);
    }

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Error al obtener estadísticas de ventas por calle:', err);
            return res.status(500).json({ error: 'Error al obtener estadísticas de ventas por calle' });
        }

        const calles = (calle && calle !== 'null' && calle !== 'undefined') 
            ? [calle] 
            : ['Calle 1', 'Calle 2', 'Calle 3', 'Calle 4', 'Calle 5', 'Calle 6', 'Calle 7', 'Callejón'];
            
        const statsMap = {};
        calles.forEach(c => {
            statsMap[c] = {
                calle: c,
                total_10kg: 0,
                total_18kg: 0,
                total_27kg: 0,
                total_43kg: 0,
                total_bombonas: 0,
                monto_10kg: 0,
                monto_18kg: 0,
                monto_27kg: 0,
                monto_43kg: 0,
                total_monto: 0
            };
        });

        results.forEach(row => {
            const c = row.calle;
            if (!statsMap[c]) return; 

            const qty10 = parseInt(row.cant_10kg) || 0;
            const qty18 = parseInt(row.cant_18kg) || 0;
            const qty27 = parseInt(row.cant_27kg) || 0;
            const qty43 = parseInt(row.cant_43kg) || 0;
            const totalCils = qty10 + qty18 + qty27 + qty43;
            const monto = parseFloat(row.monto_pagado) || 0;

            statsMap[c].total_10kg += qty10;
            statsMap[c].total_18kg += qty18;
            statsMap[c].total_27kg += qty27;
            statsMap[c].total_43kg += qty43;
            statsMap[c].total_bombonas += totalCils;
            statsMap[c].total_monto += monto;

            if (totalCils > 0) {
                statsMap[c].monto_10kg += monto * (qty10 / totalCils);
                statsMap[c].monto_18kg += monto * (qty18 / totalCils);
                statsMap[c].monto_27kg += monto * (qty27 / totalCils);
                statsMap[c].monto_43kg += monto * (qty43 / totalCils);
            }
        });

        const estadisticasCompletas = calles.map(c => statsMap[c]);
        res.json({
            estadisticas: estadisticasCompletas,
            periodo_dias: periodoDias,
            actualizado: new Date().toISOString()
        });
    });
});

// ENDPOINT PARA EL ROL DE LÍDER/SECRETARIO DE CALLE (Módulo del Usuario)
app.get('/api/usuario/ventas-calle', (req, res) => {
    const cedulaUsuario = req.query.cedula;

    if (!cedulaUsuario || cedulaUsuario === 'undefined' || cedulaUsuario === 'null') {
        return res.status(400).json({ error: "Cédula de usuario no válida o ausente" });
    }

    const queryUsuario = `SELECT id_persona, calle FROM personas WHERE cedula = ?`;

    db.query(queryUsuario, [cedulaUsuario], (err, resultados) => {
        if (err) return res.status(500).json({ error: "Error interno en la base de datos" });
        if (resultados.length === 0 || !resultados[0].calle) {
            return res.status(404).json({ error: "El usuario no tiene una calle asignada en el sistema" });
        }

        const miCalle = resultados[0].calle;
        
        const queryEstructuraAdmin = `
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

        db.query(queryEstructuraAdmin, [miCalle], (errVentas, stats) => {
            if (errVentas) return res.status(500).json({ error: "Error al calcular el balance financiero de la calle" });
            res.json({
                calle: miCalle,
                datos: stats[0]
            });
        });
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});