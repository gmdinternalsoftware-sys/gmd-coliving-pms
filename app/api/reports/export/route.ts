import { NextResponse, type NextRequest } from "next/server";
import { getDashboardStatsAction, getReportsDataAction } from "@/lib/actions/reports";
import ExcelJS from "exceljs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flatId = searchParams.get("flat_id") || "all";
    const type = searchParams.get("type") || "all"; // all | beds | occupied | vacant | dues

    // Fetch data concurrently
    const [statsRes, reportsRes] = await Promise.all([
      getDashboardStatsAction(),
      getReportsDataAction(flatId),
    ]);

    if (!reportsRes.success || !reportsRes.data) {
      return NextResponse.json(
        { error: reportsRes.error || "Failed to load report data" },
        { status: 500 }
      );
    }

    const { allBeds, occupiedBeds, vacantBeds, dues } = reportsRes.data;
    const flatsOccupancy = statsRes.data?.flatsOccupancy || [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "GMD Co-living Pvt Ltd";
    workbook.created = new Date();

    const headerFill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" }, // Primary Blue
    };

    const headerFont: Partial<ExcelJS.Font> = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    };

    function styleWorksheet(ws: ExcelJS.Worksheet) {
      // Style header row
      const headerRow = ws.getRow(1);
      headerRow.height = 28;
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "medium", color: { argb: "FF1E40AF" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      // Auto-fit column width
      ws.columns.forEach((column) => {
        let maxLength = 12;
        if (column.header) {
          maxLength = Math.max(maxLength, column.header.toString().length);
        }
        column.eachCell?.({ includeEmpty: false }, (cell) => {
          const val = cell.value ? cell.value.toString() : "";
          maxLength = Math.max(maxLength, val.length);
        });
        column.width = Math.min(maxLength + 4, 40);
      });
    }

    // Sheet 1: Property Occupancy (Only when type is all)
    if (type === "all") {
      const wsSummary = workbook.addWorksheet("Property Occupancy");
      wsSummary.columns = [
        { header: "Property Name", key: "flat_name", width: 25 },
        { header: "Address", key: "flat_address", width: 35 },
        { header: "Total Rooms", key: "total_rooms", width: 14 },
        { header: "Total Beds", key: "total_beds", width: 14 },
        { header: "Occupied Beds", key: "occupied_beds", width: 16 },
        { header: "Vacant Beds", key: "vacant_beds", width: 14 },
        { header: "Occupancy Rate (%)", key: "occupancy_rate", width: 20 },
        { header: "Potential Revenue (₹)", key: "potential_revenue", width: 22 },
        { header: "Occupied Revenue (₹)", key: "current_occupied_revenue", width: 22 },
      ];

      flatsOccupancy.forEach((f) => {
        wsSummary.addRow({
          flat_name: f.flat_name,
          flat_address: f.flat_address || "—",
          total_rooms: f.total_rooms,
          total_beds: f.total_beds,
          occupied_beds: f.occupied_beds,
          vacant_beds: f.vacant_beds,
          occupancy_rate: `${f.occupancy_rate}%`,
          potential_revenue: f.potential_revenue,
          current_occupied_revenue: f.current_occupied_revenue,
        });
      });

      styleWorksheet(wsSummary);
    }

    // Sheet 2: All Beds
    if (type === "all" || type === "beds") {
      const wsBeds = workbook.addWorksheet("All Beds Inventory");
      wsBeds.columns = [
        { header: "Property", key: "flat_name", width: 24 },
        { header: "Room No", key: "room_no", width: 14 },
        { header: "Bed Label", key: "bed_label", width: 14 },
        { header: "Sharing", key: "sharing_type", width: 12 },
        { header: "Base Price (₹)", key: "base_price", width: 16 },
        { header: "Current Status", key: "status", width: 16 },
        { header: "Current Resident", key: "tenant_name", width: 24 },
        { header: "Contact Phone", key: "tenant_phone", width: 18 },
        { header: "Move-in Date", key: "move_in_date", width: 16 },
      ];

      allBeds.forEach((b) => {
        wsBeds.addRow({
          flat_name: b.flat_name,
          room_no: b.room_no,
          bed_label: b.bed_label,
          sharing_type: `${b.sharing_type}-Sharing`,
          base_price: b.base_price,
          status: b.status.toUpperCase(),
          tenant_name: b.tenant_name || "—",
          tenant_phone: b.tenant_phone || "—",
          move_in_date: b.move_in_date || "—",
        });
      });

      styleWorksheet(wsBeds);
    }

    // Sheet 3: Occupied Beds
    if (type === "all" || type === "occupied") {
      const wsOccupied = workbook.addWorksheet("Occupied Residents");
      wsOccupied.columns = [
        { header: "Resident Full Name", key: "tenant_name", width: 26 },
        { header: "Phone Number", key: "tenant_phone", width: 18 },
        { header: "Property", key: "flat_name", width: 24 },
        { header: "Room No", key: "room_no", width: 14 },
        { header: "Bed Label", key: "bed_label", width: 14 },
        { header: "Move-in Date", key: "move_in_date", width: 16 },
        { header: "Monthly Rent (₹)", key: "agreed_rent", width: 18 },
        { header: "Deposit Paid (₹)", key: "deposit_amount", width: 18 },
        { header: "Next Rent Due", key: "next_rent_due", width: 16 },
        { header: "Notice Date", key: "notice_date", width: 16 },
      ];

      occupiedBeds.forEach((b) => {
        wsOccupied.addRow({
          tenant_name: b.tenant_name || "—",
          tenant_phone: b.tenant_phone || "—",
          flat_name: b.flat_name,
          room_no: b.room_no,
          bed_label: b.bed_label,
          move_in_date: b.move_in_date || "—",
          agreed_rent: b.agreed_rent || 0,
          deposit_amount: b.deposit_amount || 0,
          next_rent_due: b.next_rent_due || "—",
          notice_date: b.notice_date || "—",
        });
      });

      styleWorksheet(wsOccupied);
    }

    // Sheet 4: Vacant Beds
    if (type === "all" || type === "vacant") {
      const wsVacant = workbook.addWorksheet("Vacant Inventory");
      wsVacant.columns = [
        { header: "Property", key: "flat_name", width: 24 },
        { header: "Address", key: "flat_address", width: 32 },
        { header: "Room No", key: "room_no", width: 14 },
        { header: "Bed Label", key: "bed_label", width: 14 },
        { header: "Sharing Type", key: "sharing_type", width: 14 },
        { header: "Base Price (₹)", key: "base_price", width: 18 },
        { header: "Status", key: "status", width: 14 },
      ];

      vacantBeds.forEach((b) => {
        wsVacant.addRow({
          flat_name: b.flat_name,
          flat_address: b.flat_address || "—",
          room_no: b.room_no,
          bed_label: b.bed_label,
          sharing_type: `${b.sharing_type}-Sharing`,
          base_price: b.base_price,
          status: "VACANT",
        });
      });

      styleWorksheet(wsVacant);
    }

    // Sheet 5: Dues & Overdue
    if (type === "all" || type === "dues") {
      const wsDues = workbook.addWorksheet("Dues & Overdue");
      wsDues.columns = [
        { header: "Bill Type", key: "type", width: 16 },
        { header: "Resident Full Name", key: "client_name", width: 25 },
        { header: "Phone", key: "client_phone", width: 18 },
        { header: "Property", key: "flat_name", width: 22 },
        { header: "Room", key: "room_no", width: 12 },
        { header: "Bed", key: "bed_label", width: 12 },
        { header: "Billing Period / Month", key: "for_period", width: 24 },
        { header: "Due Date", key: "due_date", width: 16 },
        { header: "Total Due (₹)", key: "due_amount", width: 16 },
        { header: "Paid Amount (₹)", key: "paid_amount", width: 16 },
        { header: "Balance Due (₹)", key: "balance_due", width: 16 },
        { header: "Days Overdue", key: "days_overdue", width: 14 },
        { header: "Status", key: "status", width: 14 },
      ];

      dues.forEach((d) => {
        wsDues.addRow({
          type: d.type,
          client_name: d.client_name,
          client_phone: d.client_phone,
          flat_name: d.flat_name,
          room_no: d.room_no,
          bed_label: d.bed_label,
          for_period: d.for_period,
          due_date: d.due_date,
          due_amount: d.due_amount,
          paid_amount: d.paid_amount,
          balance_due: d.balance_due,
          days_overdue: d.days_overdue > 0 ? `${d.days_overdue} days` : "—",
          status: d.status.toUpperCase(),
        });
      });

      styleWorksheet(wsDues);
    }

    // Generate binary buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `GMD_${type.toUpperCase()}_Report_${dateStr}.xlsx`;

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("Export error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate Excel report" },
      { status: 500 }
    );
  }
}
