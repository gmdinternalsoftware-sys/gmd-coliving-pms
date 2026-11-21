import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Tenants Onboarding");

  // Define Columns
  worksheet.columns = [
    { header: "Flat Name *", key: "flat_name", width: 22 },
    { header: "Room No *", key: "room_no", width: 15 },
    { header: "Bed Label *", key: "bed_label", width: 14 },
    { header: "Tenant Full Name *", key: "full_name", width: 25 },
    { header: "Aadhaar (12 digits)", key: "aadhaar", width: 22 },
    { header: "Phone 1 (10 digits) *", key: "phone1", width: 22 },
    { header: "Phone 2 (optional)", key: "phone2", width: 20 },
    { header: "Move-in Date (YYYY-MM-DD) *", key: "move_in_date", width: 26 },
    { header: "Monthly Rent (₹) *", key: "agreed_rent", width: 18 },
    { header: "Deposit Paid (₹)", key: "deposit_amount", width: 18 },
    { header: "Next Rent Due (YYYY-MM-DD) *", key: "next_rent_due", width: 26 },
    { header: "Opening Dues (₹)", key: "opening_dues", width: 18 },
  ];

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" }, // Primary blue
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  // Add Sample Row
  worksheet.addRow({
    flat_name: "Sunrise Villa",
    room_no: "R1",
    bed_label: "A",
    full_name: "Anand Verma",
    aadhaar: "123456789012",
    phone1: "9876543210",
    phone2: "9876543211",
    move_in_date: "2026-11-01",
    agreed_rent: 7500,
    deposit_amount: 15000,
    next_rent_due: "2026-12-01",
    opening_dues: 0,
  });

  // Generate Buffer
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="GMD_Tenants_Import_Template.xlsx"',
    },
  });
}
