import { useState } from 'react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import billsData from '../data/bills.json'
import './DownloadButton.css'

function DownloadButton({ filteredBills, filteredRiders }) {
  const [isOpen, setIsOpen] = useState(false)

  const getCategoryName = (categoryId) => {
    const category = billsData.categories.find(cat => cat.id === categoryId)
    return category ? category.name : categoryId
  }

  const getPriorityLabel = (priority) => {
    const labels = {
      high: 'HIGH PRIORITY',
      medium: 'Medium',
      low: 'Low',
      watching: 'Watching'
    }
    return labels[priority] || priority
  }

  const exportToCSV = (bills, riders, filename) => {
    // Define CSV headers
    const headers = ['Type', 'Priority', 'Bill Numbers', 'Title', 'Category', 'Sponsors', 'Description']

    // Convert bills to CSV rows
    const billRows = bills.map(bill => [
      bill.type || 'bill',
      getPriorityLabel(bill.priority),
      bill.billNumbers.join(', '),
      bill.title,
      getCategoryName(bill.category),
      bill.sponsors.join(', '),
      bill.description
    ])

    // Convert riders to CSV rows
    const riderRows = (riders || []).map(rider => [
      'rider',
      getPriorityLabel(rider.priority),
      rider.billNumbers.join(', '),
      rider.title,
      getCategoryName(rider.category),
      rider.sponsors.join(', '),
      rider.description
    ])

    // Combine all rows
    const allRows = [...billRows, ...riderRows]

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...allRows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
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

  const exportToPDF = (bills, riders, filename) => {
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
    doc.text(`Total Items: ${bills.length + (riders?.length || 0)} (${bills.length} bills, ${riders?.length || 0} riders)`, 14, 43)

    let currentY = 50

    // Separate bills by priority
    const highPriorityBills = bills.filter(b => b.priority === 'high')
    const otherBills = bills.filter(b => b.priority !== 'high')

    // Section 1: High Priority Bills
    if (highPriorityBills.length > 0) {
      doc.setFontSize(12)
      doc.setTextColor(220, 20, 60)
      doc.text(`HIGH PRIORITY BILLS (${highPriorityBills.length})`, 14, currentY)
      currentY += 5

      const highPriorityData = highPriorityBills.map(bill => [
        bill.billNumbers.join('\n'),
        bill.title,
        getCategoryName(bill.category),
        bill.sponsors.join('\n'),
        bill.description
      ])

      doc.autoTable({
        startY: currentY,
        head: [['Bill #', 'Title', 'Category', 'Sponsors', 'Description']],
        body: highPriorityData,
        headStyles: {
          fillColor: [220, 20, 60],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 30 },
          3: { cellWidth: 35 },
          4: { cellWidth: 'auto' }
        },
        styles: {
          overflow: 'linebreak',
          cellPadding: 2,
          fontSize: 8,
          valign: 'top'
        },
        margin: { left: 14, right: 14 },
        theme: 'striped',
        alternateRowStyles: {
          fillColor: [255, 245, 245]
        }
      })

      currentY = doc.lastAutoTable.finalY + 10
    }

    // Section 2: Budget Riders
    if (riders && riders.length > 0) {
      // Check if we need a new page
      if (currentY > 250) {
        doc.addPage()
        currentY = 20
      }

      doc.setFontSize(12)
      doc.setTextColor(255, 140, 0)
      doc.text(`BUDGET RIDERS (${riders.length})`, 14, currentY)
      currentY += 5

      const riderData = riders.map(rider => [
        rider.billNumbers.join('\n'),
        rider.title,
        getCategoryName(rider.category),
        rider.sponsors.join('\n'),
        rider.description
      ])

      doc.autoTable({
        startY: currentY,
        head: [['Bill #', 'Title', 'Category', 'Sponsors', 'Description']],
        body: riderData,
        headStyles: {
          fillColor: [255, 140, 0],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 30 },
          3: { cellWidth: 35 },
          4: { cellWidth: 'auto' }
        },
        styles: {
          overflow: 'linebreak',
          cellPadding: 2,
          fontSize: 8,
          valign: 'top'
        },
        margin: { left: 14, right: 14 },
        theme: 'striped',
        alternateRowStyles: {
          fillColor: [255, 248, 240]
        }
      })

      currentY = doc.lastAutoTable.finalY + 10
    }

    // Section 3: Other Bills
    if (otherBills.length > 0) {
      // Check if we need a new page
      if (currentY > 250) {
        doc.addPage()
        currentY = 20
      }

      doc.setFontSize(12)
      doc.setTextColor(153, 153, 153)
      doc.text(`OTHER INTRODUCED BILLS (${otherBills.length})`, 14, currentY)
      currentY += 5

      const otherData = otherBills.map(bill => [
        bill.billNumbers.join('\n'),
        bill.title,
        getCategoryName(bill.category),
        bill.sponsors.join('\n'),
        bill.description
      ])

      doc.autoTable({
        startY: currentY,
        head: [['Bill #', 'Title', 'Category', 'Sponsors', 'Description']],
        body: otherData,
        headStyles: {
          fillColor: [153, 153, 153],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 30 },
          3: { cellWidth: 35 },
          4: { cellWidth: 'auto' }
        },
        styles: {
          overflow: 'linebreak',
          cellPadding: 2,
          fontSize: 8,
          valign: 'top'
        },
        margin: { left: 14, right: 14 },
        theme: 'striped',
        alternateRowStyles: {
          fillColor: [249, 249, 249]
        }
      })
    }

    // Save the PDF
    doc.save(filename)
  }

  const handleDownload = (format, scope) => {
    const bills = scope === 'filtered' ? filteredBills : (billsData.bills || [])
    const riders = scope === 'filtered' ? filteredRiders : (billsData.riders || [])
    const scopeText = scope === 'filtered' ? 'filtered' : 'all'
    const timestamp = new Date().toISOString().split('T')[0]

    if (format === 'csv') {
      exportToCSV(bills, riders, `dc-bills-${scopeText}-${timestamp}.csv`)
    } else if (format === 'pdf') {
      exportToPDF(bills, riders, `dc-bills-${scopeText}-${timestamp}.pdf`)
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
              <h4>Filtered Items ({filteredBills.length + (filteredRiders?.length || 0)})</h4>
              <p className="download-description">
                Download currently visible items ({filteredBills.length} bills, {filteredRiders?.length || 0} riders)
              </p>
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
              <h4>All Items ({(billsData.bills?.length || 0) + (billsData.riders?.length || 0)})</h4>
              <p className="download-description">
                Download complete dataset ({billsData.bills?.length || 0} bills, {billsData.riders?.length || 0} riders)
              </p>
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
