const { PDFDocument } = require('pdf-lib');
const https = require('https');

const url = process.argv[2];

https.get(url, (res) => {
  const chunks = [];
  res.on('data', (d) => chunks.push(d));
  res.on('end', async () => {
    const pdf = await PDFDocument.load(Buffer.concat(chunks));
    console.log(JSON.stringify({
      status: res.statusCode,
      contentType: res.headers['content-type'],
      title: pdf.getTitle(),
      subject: pdf.getSubject(),
      author: pdf.getAuthor(),
    }, null, 2));
  });
}).on('error', (err) => {
  console.error(err);
  process.exit(1);
});
