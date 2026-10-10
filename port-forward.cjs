const http = require('http');

const ports = [5174, 5175];

ports.forEach((port) => {
	const server = http.createServer((req, res) => {
		const targetUrl = `http://localhost:5173${req.url}`;
		res.writeHead(307, {
			Location: targetUrl,
			'Access-Control-Allow-Origin': '*'
		});
		res.end(`Redirigiendo a ${targetUrl}`);
	});

	server.on('error', (err) => {
		console.warn(`[PortForward] Puerto ${port} no disponible:`, err.message);
	});

	server.listen(port, '127.0.0.1', () => {
		console.log(`[PortForward] Redirección activa en http://127.0.0.1:${port} -> http://localhost:5173`);
	});
});
