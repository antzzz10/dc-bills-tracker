import { useState } from 'react'
import jsPDF from 'jspdf'
import { applyPlugin } from 'jspdf-autotable'
import billsData from '../data/bills.json'
import { track, EVENTS } from '../lib/analytics'
import './DownloadButton.css'
import Icon from './Icon'
import { countUnits, describeKinds } from '../lib/measureCounts'
import { isActive } from '../lib/measureStatus'

// jspdf-autotable 5 no longer adds doc.autoTable as a side effect of importing it; the
// PDF download threw "autoTable is not a function" until this was called (found 2026-11-13).
applyPlugin(jsPDF)

// Barriers to statehood are exported in their own labelled rows and section, and never
// added into the anti-DC totals (decisions/2026-11-12-statehood-barriers-category.md).
const barrierNote = count =>
  count > 0 ? `${count} ${count === 1 ? 'barrier' : 'barriers'} to statehood` : ''

function DownloadButton({ filteredBills, filteredRiders, filteredBarriers = [] }) {
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

  const exportToCSV = (bills, riders, barriers, filename) => {
    // Define CSV headers
    const headers = ['Type', 'Priority', 'Bill numbers', 'Title', 'Category', 'Sponsors', 'Description']

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

    const barrierRows = (barriers || []).map(barrier => [
      'barrier to statehood',
      getPriorityLabel(barrier.priority),
      barrier.billNumbers.join(', '),
      barrier.title,
      getCategoryName(barrier.category),
      barrier.sponsors.join(', '),
      barrier.description
    ])

    // Combine all rows
    const allRows = [...billRows, ...riderRows, ...barrierRows]

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

  const exportToPDF = (bills, riders, barriers, filename) => {
    const doc = new jsPDF()

    // Add title
    doc.setFontSize(18)
    doc.setTextColor(220, 20, 60) // DC red
    doc.text('Anti-DC bills tracker', 14, 20)

    // Add subtitle
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text('Bills, resolutions and budget riders in Congress that threaten D.C. home rule and autonomy', 14, 27)

    // Add date
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 33)
    doc.text(`Last Updated: ${__BUILD_DATE__}`, 14, 38)
    // Measures, not entries (src/lib/measureCounts.js): H.R. 1968 is three rows, one law.
    doc.text(`Total: ${describeKinds(countUnits([...bills, ...(riders || [])])) || 'no anti-D.C. bills, resolutions or budget riders'}`, 14, 43)
    const barrierCount = countUnits(barriers || []).total
    if (barrierCount > 0) {
      doc.text(`Listed separately, not in the total: ${barrierNote(barrierCount)}`, 14, 48)
    }

    let currentY = barrierCount > 0 ? 55 : 50

    // Separate bills by priority
    const highPriorityBills = bills.filter(b => b.priority === 'high')
    const otherBills = bills.filter(b => b.priority !== 'high')

    // Section 1: High Priority Bills
    if (highPriorityBills.length > 0) {
      doc.setFontSize(12)
      doc.setTextColor(220, 20, 60)
      doc.text(`HIGH PRIORITY BILLS (${countUnits(highPriorityBills).total})`, 14, currentY)
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
      doc.text(`BUDGET RIDERS (${countUnits(riders).total})`, 14, currentY)
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
      doc.text(`OTHER INTRODUCED BILLS (${countUnits(otherBills).total})`, 14, currentY)
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

      currentY = doc.lastAutoTable.finalY + 10
    }

    // Section 4: Barriers to statehood (not home-rule attacks; counted apart)
    if (barrierCount > 0) {
      if (currentY > 250) {
        doc.addPage()
        currentY = 20
      }

      doc.setFontSize(12)
      doc.setTextColor(20, 33, 61)
      doc.text(`BARRIERS TO STATEHOOD (${barrierCount})`, 14, currentY)
      currentY += 5

      doc.autoTable({
        startY: currentY,
        head: [['Bill #', 'Title', 'Category', 'Sponsors', 'Description']],
        body: barriers.map(barrier => [
          barrier.billNumbers.join('\n'),
          barrier.title,
          getCategoryName(barrier.category),
          barrier.sponsors.join('\n'),
          barrier.description
        ]),
        headStyles: { fillColor: [20, 33, 61], textColor: 255, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 30 },
          3: { cellWidth: 35 },
          4: { cellWidth: 'auto' }
        },
        styles: { overflow: 'linebreak', cellPadding: 2, fontSize: 8, valign: 'top' },
        margin: { left: 14, right: 14 },
        theme: 'striped'
      })
    }

    // Save the PDF
    doc.save(filename)
  }

  const allBarriers = (billsData.statehoodBarriers || []).filter(isActive)

  const handleDownload = (format, scope) => {
    // "All" scope reads straight from billsData, so provisional (unreviewed)
    // entries must be excluded here too, same as the on-site sections.
    const bills = scope === 'filtered' ? filteredBills : (billsData.bills || []).filter(isActive)
    const riders = scope === 'filtered' ? filteredRiders : (billsData.riders || []).filter(isActive)
    const barriers = scope === 'filtered' ? filteredBarriers : allBarriers
    const scopeText = scope === 'filtered' ? 'filtered' : 'all'
    const timestamp = new Date().toISOString().split('T')[0]

    track(EVENTS.EXPORT_DOWNLOADED, {
      format,
      scope: scopeText,
      itemCount: bills.length + riders.length + barriers.length,
    })

    if (format === 'csv') {
      exportToCSV(bills, riders, barriers, `dc-bills-${scopeText}-${timestamp}.csv`)
    } else if (format === 'pdf') {
      exportToPDF(bills, riders, barriers, `dc-bills-${scopeText}-${timestamp}.pdf`)
    }

    setIsOpen(false)
  }

  // Same set the "all" download exports: reviewed entries only.
  const allReviewed = [...(billsData.bills || []), ...(billsData.riders || [])].filter(isActive)
  const filteredAttacks = [...filteredBills, ...(filteredRiders || [])]
  // Header counts are everything the file will hold; the description keeps anti-DC
  // measures and barriers apart.
  const describeScope = (attacks, barriers) => {
    const barrierCount = countUnits(barriers).total
    const attackCount = countUnits(attacks).total
    if (barrierCount === 0) return describeKinds(countUnits(attacks))
    if (attackCount === 0) return barrierNote(barrierCount)
    return `${describeKinds(countUnits(attacks))}, plus ${barrierNote(barrierCount)}`
  }

  return (
    <div className="download-container">
      <button
        className="download-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon name="download" size={17} />
        Download
      </button>

      {isOpen && (
        <>
          <div className="download-backdrop" onClick={() => setIsOpen(false)} />
          <div className="download-menu">
            <div className="download-menu-header">
              <h3>Download bills</h3>
            </div>

            <div className="download-section">
              <h4>Filtered Items ({countUnits(filteredAttacks).total + countUnits(filteredBarriers).total})</h4>
              <p className="download-description">
                Download matching pending and passed items ({describeScope(filteredAttacks, filteredBarriers)})
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
              <h4>All Items ({countUnits(allReviewed).total + countUnits(allBarriers).total})</h4>
              <p className="download-description">
                Download complete dataset ({describeScope(allReviewed, allBarriers)})
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
