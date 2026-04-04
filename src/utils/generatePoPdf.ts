import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface PoLineItem {
  id: string;
  poNumber: string;
  createdAt: string;
  orderQuantity: number;
  status: string;
  expectedArrival?: string;
  notes?: string;
  packagingOrdered?: boolean;
  sku: { skuCode: string; productDescription: string; unitCost: number };
  supplier: { name: string; contactName?: string; contactEmail?: string; shipToAddress?: string };
}

export function generatePoPdf(poNumber: string, lineItems: PoLineItem[]) {
  const doc = new jsPDF();
  const firstItem = lineItems[0];
  const supplier = firstItem.supplier;
  const dateSubmitted = firstItem.createdAt ? format(new Date(firstItem.createdAt), 'MM/dd/yyyy') : 'N/A';

  // ── Header ──
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER', 14, 25);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('InventoryOS', 14, 33);
  doc.setTextColor(0);

  // PO Number box (right side)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PO #:', 140, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.text(poNumber, 155, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', 140, 28);
  doc.setFont('helvetica', 'normal');
  doc.text(dateSubmitted, 155, 28);

  doc.setFont('helvetica', 'bold');
  doc.text('Status:', 140, 36);
  doc.setFont('helvetica', 'normal');
  doc.text(firstItem.status, 160, 36);

  // ── Divider ──
  doc.setDrawColor(200);
  doc.line(14, 42, 196, 42);

  // ── Supplier Info ──
  let y = 52;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100);
  doc.text('SUPPLIER', 14, y);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  y += 7;
  doc.text(supplier.name, 14, y);
  if (supplier.contactName) {
    y += 6;
    doc.setFontSize(10);
    doc.text(supplier.contactName, 14, y);
  }
  if (supplier.contactEmail) {
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 180);
    doc.text(supplier.contactEmail, 14, y);
    doc.setTextColor(0);
  }
  if (supplier.shipToAddress) {
    y += 6;
    doc.setFontSize(9);
    doc.text(supplier.shipToAddress, 14, y);
  }

  // ── Expected Arrival (right side) ──
  const expectedDate = firstItem.expectedArrival
    ? format(new Date(firstItem.expectedArrival), 'MM/dd/yyyy')
    : 'TBD';
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100);
  doc.text('EXPECTED ARRIVAL', 140, 52);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(expectedDate, 140, 59);

  // ── Line Items Table ──
  const tableStartY = Math.max(y + 15, 85);

  const tableData = lineItems.map((item, index) => [
    String(index + 1),
    item.sku.skuCode,
    item.sku.productDescription,
    item.orderQuantity.toLocaleString(),
    `$${item.sku.unitCost.toFixed(2)}`,
    `$${(item.orderQuantity * item.sku.unitCost).toFixed(2)}`,
  ]);

  const totalQty = lineItems.reduce((sum, item) => sum + item.orderQuantity, 0);
  const totalCost = lineItems.reduce((sum, item) => sum + item.orderQuantity * item.sku.unitCost, 0);

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'SKU', 'Description', 'Qty', 'Unit Cost', 'Line Total']],
    body: tableData,
    foot: [['', '', 'TOTAL', totalQty.toLocaleString(), '', `$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    footStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 30, font: 'courier' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Notes section ──
  const finalY = (doc as any).lastAutoTable.finalY + 12;
  const notes = lineItems.map(i => i.notes).filter(Boolean);
  const packagingOrdered = lineItems.some(i => i.packagingOrdered);

  if (notes.length > 0 || packagingOrdered) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100);
    doc.text('NOTES', 14, finalY);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    let noteY = finalY + 7;
    if (packagingOrdered) {
      doc.text('• Packaging ordered', 14, noteY);
      noteY += 6;
    }
    for (const note of notes) {
      const lines = doc.splitTextToSize(`• ${note}`, 170);
      doc.text(lines, 14, noteY);
      noteY += lines.length * 5;
    }
  }

  // ── Footer ──
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated ${format(new Date(), 'MM/dd/yyyy h:mm a')} — InventoryOS`, 14, pageHeight - 10);
  doc.text(`PO ${poNumber}`, 196, pageHeight - 10, { align: 'right' });

  // Save
  doc.save(`PO-${poNumber}.pdf`);
}
