import { jsPDF } from 'jspdf'

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadPdf(filename: string, title: string, headers: string[], rows: Array<Array<string | number>>) {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 16
  const columnWidth = (pageWidth - margin * 2) / headers.length
  let y = 30

  const drawHeader = () => {
    pdf.setFillColor(15, 23, 42)
    pdf.rect(0, 0, pageWidth, 20, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(14)
    pdf.text('BCC/CAT Security Group', margin, 13)
    pdf.setTextColor(17, 24, 39)
    pdf.setFontSize(16)
    pdf.text(title, margin, y)
    y += 12
    pdf.setFillColor(240, 101, 34)
    pdf.rect(margin, y - 8, pageWidth - margin * 2, 8, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(9)
    headers.forEach((header, index) => pdf.text(String(header), margin + index * columnWidth + 2, y - 2))
    y += 8
    pdf.setTextColor(17, 24, 39)
    pdf.setFontSize(9)
  }

  drawHeader()
  rows.forEach(row => {
    if (y > pageHeight - 18) {
      pdf.addPage()
      y = 30
      drawHeader()
    }
    row.forEach((value, index) => {
      const cellText = pdf.splitTextToSize(String(value), Math.max(columnWidth - 4, 12))
      pdf.text(cellText, margin + index * columnWidth + 2, y)
    })
    y += 8
  })

  pdf.setFontSize(8)
  pdf.setTextColor(100, 116, 139)
  pdf.text(`Generated: ${new Date().toLocaleString('en-PH', { hour12: false })}`, margin, pageHeight - 10)
  pdf.save(filename)
}
