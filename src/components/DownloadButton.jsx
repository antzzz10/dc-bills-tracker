import { useState } from 'react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import billsData from '../data/bills.json'
import './DownloadButton.css'

function DownloadButton({ filteredBills }) {
  const [isOpen, setIsOpen] = useState(false)

  const getCategoryName = (categoryId) => {
    const category = billsData.categories.find(cat => cat.id === categoryId)
    return category ? category.name : categoryId
  }

  const exportToCSV = (bills, filename) => {
    // Define CSV headers
    const headers = ['Bill Numbers', 'Title', 'Category', 'Sponsors', 'Description']

    // Convert bills to CSV rows
    const rows = bills.map(bill => [
      bill.billNumbers.join(', '),
      bill.title,
      getCategoryName(bill.category),
      bill.sponsors.join(', '),
      bill.description
    ])

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n')

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToPDF = (bills, filename) => {
    const doc = new jsPDF()

    // Add title
    doc.setFontSize(18)
    doc.setTextColor(220, 20, 60) // DC red
    doc.text('Anti-DC Bills Tracker', 14, 20)

    // Add subtitle
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text('Bills pending in Congress that threaten D.C. home rule and autonomy', 14, 27)

    // Add date
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 33)
    doc.text(`Last Updated: ${billsData.lastUpdated}`, 14, 38)
    doc.text(`Total Bills: ${bills.length}`, 14, 43)

    // Prepare table data
    const tableData = bills.map(bill => [
      bill.billNumbers.join('\n'),
      bill.title,
      getCategoryName(bill.category),
      bill.sponsors.join('\n'),
      bill.description
    ])

    // Add table
    doc.autoTable({
      startY: 50,
      head: [['Bill #', 'Title', 'Category', 'Sponsors', 'Description']],
      body: tableData,
      headStyles: {
        fillColor: [220, 20, 60], // DC red
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 25 },  // Bill Numbers
        1: { cellWidth: 40 },  // Title
        2: { cellWidth: 30 },  // Category
        3: { cellWidth: 35 },  // Sponsors
        4: { cellWidth: 'auto' } // Description
      },
      styles: {
        overflow: 'linebreak',
        cellPadding: 2,
        fontSize: 8,
        valign: 'top'
      },
      margin: { top: 50, left: 14, right: 14 },
      theme: 'striped',
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    })

    // Save the PDF
    doc.save(filename)
  }

  const handleDownload = (format, scope) => {
    const bills = scope === 'filtered' ? filteredBills : billsData.bills
    const scopeText = scope === 'filtered' ? 'filtered' : 'all'
    const timestamp = new Date().toISOString().split('T')[0]

    if (format === 'csv') {
      exportToCSV(bills, `dc-bills-${scopeText}-${timestamp}.csv`)
    } else if (format === 'pdf') {
      exportToPDF(bills, `dc-bills-${scopeText}-${timestamp}.pdf`)
    }

    setIsOpen(false)
  }

  return (
    <div className="download-container">
      <button
        className="download-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="download-icon">⬇</span>
        Download
      </button>

      {isOpen && (
        <>
          <div className="download-backdrop" onClick={() => setIsOpen(false)} />
          <div className="download-menu">
            <div className="download-menu-header">
              <h3>Download Bills</h3>
            </div>

            <div className="download-section">
              <h4>Filtered Bills ({filteredBills.length})</h4>
              <p className="download-description">Download currently visible bills</p>
              <div className="download-buttons">
                <button
                  className="download-option"
                  onClick={() => handleDownload('csv', 'filtered')}
                >
                  CSV Format
                </button>
                <button
                  className="download-option"
                  onClick={() => handleDownload('pdf', 'filtered')}
                >
                  PDF Format
                </button>
              </div>
            </div>

            <div className="download-divider" />

            <div className="download-section">
              <h4>All Bills ({billsData.bills.length})</h4>
              <p className="download-description">Download complete dataset</p>
              <div className="download-buttons">
                <button
                  className="download-option"
                  onClick={() => handleDownload('csv', 'all')}
                >
                  CSV Format
                </button>
                <button
                  className="download-option"
                  onClick={() => handleDownload('pdf', 'all')}
                >
                  PDF Format
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default DownloadButton
