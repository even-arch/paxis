-- rename_document_models
-- Rename tables to match new model names

ALTER TABLE "SLS_Order" RENAME TO "PO_CustomerCopy";
ALTER TABLE "SLS_Item" RENAME TO "PO_CustomerCopy_Item";
ALTER TABLE "SLS_PI" RENAME TO "PI";
ALTER TABLE "SLS_PIItem" RENAME TO "PI_Item";
ALTER TABLE "SLS_Shipment" RENAME TO "SLS";
ALTER TABLE "SLS_ShipmentPI" RENAME TO "SLS_PI_Link";
ALTER TABLE "SLS_ShipmentItem" RENAME TO "SLS_Item";
ALTER TABLE "PO_Order" RENAME TO "PO";
ALTER TABLE "PO_SupplierPI" RENAME TO "PI_SupplierCopy";
ALTER TABLE "PO_SupplierPIItem" RENAME TO "PI_SupplierCopy_Item";
