-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."COST_Sheet" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "fobPrice" DECIMAL(65,30) NOT NULL,
    "fobCurrency" TEXT NOT NULL,
    "fobExRate" DECIMAL(65,30) NOT NULL,
    "countryOfOrigin" TEXT,
    "portOfLoading" TEXT,
    "htsCode" TEXT,
    "dutyRate" DECIMAL(65,30),
    "dutyAmount" DECIMAL(65,30),
    "oceanFreight" DECIMAL(65,30),
    "insurance" DECIMAL(65,30),
    "agentFee" DECIMAL(65,30),
    "consolidation" DECIMAL(65,30),
    "deconsolidation" DECIMAL(65,30),
    "userFee" DECIMAL(65,30),
    "harborFee" DECIMAL(65,30),
    "otherCharge" DECIMAL(65,30),
    "otherChargeNote" TEXT,
    "landedCost" DECIMAL(65,30),
    "sellingPrice" DECIMAL(65,30),
    "grossMarginPct" DECIMAL(65,30),
    "container40ftQty" INTEGER,
    "container40ftPcs" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "COST_Sheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CUS_Contact" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "phoneNo" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CUS_Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CUS_Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "countryCode" TEXT,
    "postalCode" TEXT,
    "phoneNo" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "taxId" TEXT,
    "paymentTerms" TEXT,
    "currencyCode" TEXT,
    "note" TEXT,
    "patiscoBuyerId" TEXT,
    "defaultTradeTerms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "collectionCycleDays" INTEGER,
    "shippingMarkTemplate" TEXT,
    "chargeTemplateId" INTEGER,
    "syncJobId" INTEGER,

    CONSTRAINT "CUS_Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CUS_CustomerProduct" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "lastUnitPrice" DECIMAL(65,30),
    "currencyCode" TEXT,
    "lastOrderDate" TIMESTAMP(3),
    "orderCount" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CUS_CustomerProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FIN_Payable" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "receiptId" INTEGER,
    "amountTWD" DECIMAL(65,30) NOT NULL,
    "customsFeeTWD" DECIMAL(65,30),
    "truckingFeeTWD" DECIMAL(65,30),
    "containerFeeTWD" DECIMAL(65,30),
    "bankFeePct" DECIMAL(65,30),
    "portServiceFeeTWD" DECIMAL(65,30),
    "wireTransferFeeTWD" DECIMAL(65,30),
    "commissionTWD" DECIMAL(65,30),
    "otherAdjustmentTWD" DECIMAL(65,30),
    "otherAdjustmentNote" TEXT,
    "vatPct" DECIMAL(65,30),
    "finalWireAmountTWD" DECIMAL(65,30),
    "fobCostDeductionTWD" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "status" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "paidAmountTWD" DECIMAL(65,30),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "batchPayableId" INTEGER,
    "poId" INTEGER,
    "shipmentId" INTEGER,

    CONSTRAINT "FIN_Payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FIN_PaymentVoucher" (
    "id" SERIAL NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "vatPct" DECIMAL(65,30) NOT NULL DEFAULT 5,
    "note" TEXT,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FIN_PaymentVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FIN_PaymentVoucherAdjustment" (
    "id" SERIAL NOT NULL,
    "voucherId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amountTWD" DECIMAL(65,30) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "note" TEXT,

    CONSTRAINT "FIN_PaymentVoucherAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FIN_PaymentVoucherItem" (
    "id" SERIAL NOT NULL,
    "voucherId" INTEGER NOT NULL,
    "payableId" INTEGER NOT NULL,
    "amountTWD" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "FIN_PaymentVoucherItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FIN_Receivable" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "customerName" TEXT,
    "shipmentId" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "amountForeign" DECIMAL(65,30) NOT NULL,
    "rateAtInvoice" DECIMAL(65,30) NOT NULL,
    "amountTWD" DECIMAL(65,30) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" INTEGER NOT NULL DEFAULT 0,
    "collectedAt" TIMESTAMP(3),
    "collectedForeign" DECIMAL(65,30),
    "rateAtCollection" DECIMAL(65,30),
    "collectedTWD" DECIMAL(65,30),
    "fxGainLoss" DECIMAL(65,30),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "batchReceivableId" INTEGER,

    CONSTRAINT "FIN_Receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."INV_Adjustment" (
    "id" SERIAL NOT NULL,
    "adjustNo" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "beforeQty" INTEGER NOT NULL,
    "afterQty" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "performedBy" INTEGER NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "INV_Adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."INV_Movement" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "type" INTEGER NOT NULL,
    "qtyDelta" INTEGER NOT NULL,
    "reservedDelta" INTEGER NOT NULL DEFAULT 0,
    "quantityAfter" INTEGER NOT NULL,
    "reservedAfter" INTEGER NOT NULL,
    "performedBy" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "receiptId" INTEGER,
    "slsPiId" INTEGER,
    "slsShipmentId" INTEGER,
    "adjustmentId" INTEGER,
    "patiscoDocType" TEXT,
    "patiscoDocId" TEXT,
    "patiscoDocNo" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "INV_Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."INV_Stock" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "INV_Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MKT_Channel" (
    "id" SERIAL NOT NULL,
    "platform" TEXT NOT NULL,
    "label" TEXT,
    "apiKey" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "saltKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MKT_Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MKT_Order" (
    "id" SERIAL NOT NULL,
    "channelId" INTEGER NOT NULL,
    "platformOrderNo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "buyerName" TEXT,
    "buyerPhone" TEXT,
    "buyerAddress" TEXT,
    "logisticsCode" TEXT,
    "logisticsTrackingNo" TEXT,
    "logisticsId" TEXT,
    "waybillPrinted" BOOLEAN NOT NULL DEFAULT false,
    "totalAmount" DECIMAL(65,30),
    "rawPayload" JSONB,
    "slsOrderId" INTEGER,
    "paidAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MKT_Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MKT_OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "platformSku" TEXT NOT NULL,
    "paxisSku" TEXT,
    "productId" INTEGER,
    "itemName" TEXT,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30),

    CONSTRAINT "MKT_OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MKT_SkuMapping" (
    "id" SERIAL NOT NULL,
    "channelId" INTEGER NOT NULL,
    "platformSku" TEXT NOT NULL,
    "paxisSku" TEXT NOT NULL,
    "productId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MKT_SkuMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MKT_SyncLog" (
    "id" SERIAL NOT NULL,
    "channelId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "platformOrderNo" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MKT_SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PI" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER,
    "piNo" TEXT NOT NULL,
    "customerId" INTEGER,
    "currencyCode" TEXT,
    "totalAmount" DECIMAL(65,30),
    "piDate" TIMESTAMP(3),
    "estimatedShipDate" TIMESTAMP(3),
    "etd" TIMESTAMP(3),
    "tradeTermsCode" INTEGER,
    "extraCharges" JSONB,
    "status" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "performedBy" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patiscoDocId" TEXT,
    "patiscoDocNo" TEXT,
    "patiscoCreatedAt" TIMESTAMP(3),
    "patiscoStatus" TEXT,
    "syncJobId" INTEGER,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PI_Item" (
    "id" SERIAL NOT NULL,
    "piId" INTEGER NOT NULL,
    "slsItemId" INTEGER,
    "productId" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30),
    "unit" TEXT,
    "unitPerCarton" INTEGER,
    "cbm" DECIMAL(65,30),
    "grossWeight" DECIMAL(65,30),
    "netWeight" DECIMAL(65,30),

    CONSTRAINT "PI_Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PI_SupplierCopy" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "piNo" TEXT NOT NULL,
    "piDate" TIMESTAMP(3),
    "estimatedShipDate" TIMESTAMP(3),
    "note" TEXT,
    "tradeTermsCode" INTEGER,
    "extraCharges" JSONB,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "performedBy" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patiscoDocId" TEXT,
    "patiscoDocNo" TEXT,
    "patiscoCreatedAt" TIMESTAMP(3),
    "patiscoStatus" TEXT,
    "syncJobId" INTEGER,

    CONSTRAINT "PI_SupplierCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PI_SupplierCopy_Item" (
    "id" SERIAL NOT NULL,
    "supplierPIId" INTEGER NOT NULL,
    "poItemId" INTEGER NOT NULL,
    "confirmedQty" INTEGER NOT NULL,

    CONSTRAINT "PI_SupplierCopy_Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PO" (
    "id" SERIAL NOT NULL,
    "poNo" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "slsPiId" INTEGER,
    "salesOrderId" INTEGER,
    "status" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30),
    "orderDate" TIMESTAMP(3),
    "expectedDate" TIMESTAMP(3),
    "shippedDate" TIMESTAMP(3),
    "arrivedDate" TIMESTAMP(3),
    "port" TEXT,
    "shipVia" TEXT,
    "note" TEXT,
    "tradeTerms" TEXT,
    "sourceType" INTEGER NOT NULL DEFAULT 0,
    "patiscoOrderNo" TEXT,
    "patiscoOrderId" TEXT,
    "patiscoStatus" TEXT,
    "patiscoCreatedAt" TIMESTAMP(3),
    "syncJobId" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PO_CustomerCopy" (
    "id" SERIAL NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customerId" INTEGER,
    "status" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30),
    "orderDate" TIMESTAMP(3),
    "customerRequestedShipDate" TIMESTAMP(3),
    "customerPoNo" TEXT,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "performedBy" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patiscoBuyerId" TEXT,
    "patiscoBuyerName" TEXT,
    "patiscoDocId" TEXT,
    "patiscoDocNo" TEXT,
    "patiscoCreatedAt" TIMESTAMP(3),
    "patiscoStatus" TEXT,
    "syncJobId" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PO_CustomerCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PO_CustomerCopy_Item" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "shippedQty" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT,
    "note" TEXT,
    "customerSkuRef" TEXT,
    "productNameSnapshot" TEXT,

    CONSTRAINT "PO_CustomerCopy_Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PO_Item" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT,
    "note" TEXT,
    "productNameSnapshot" TEXT,

    CONSTRAINT "PO_Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PO_Receipt" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "performedBy" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patiscoDocId" TEXT,
    "patiscoDocNo" TEXT,
    "note" TEXT,

    CONSTRAINT "PO_Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PO_ReceiptItem" (
    "id" SERIAL NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "poItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PO_ReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PO_ShippingNotice" (
    "id" SERIAL NOT NULL,
    "noticeNo" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "deliverToName" TEXT,
    "deliverToAddress" TEXT,
    "deliverToContact" TEXT,
    "sourceShipmentId" INTEGER,
    "note" TEXT,
    "performedBy" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PO_ShippingNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PO_ShippingNoticeItem" (
    "id" SERIAL NOT NULL,
    "noticeId" INTEGER NOT NULL,
    "poId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "poQuantity" INTEGER NOT NULL,
    "notifiedQuantity" INTEGER NOT NULL,
    "unit" TEXT,
    "unitPrice" DECIMAL(65,30),

    CONSTRAINT "PO_ShippingNoticeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PRD_Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,

    CONSTRAINT "PRD_Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PRD_CategoryMapping" (
    "productId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "PRD_CategoryMapping_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "public"."PRD_Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "modelNo" TEXT,
    "description" TEXT,
    "specification" TEXT,
    "unitPerInner" INTEGER,
    "unitPerCarton" INTEGER,
    "cbm" DECIMAL(65,30),
    "grossWeight" DECIMAL(65,30),
    "netWeight" DECIMAL(65,30),
    "length" DECIMAL(65,30),
    "width" DECIMAL(65,30),
    "height" DECIMAL(65,30),
    "htsCode" TEXT,
    "countryOfOrigin" TEXT,
    "unit" TEXT,
    "isMadeToOrder" BOOLEAN NOT NULL DEFAULT false,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "patiscoProductId" TEXT,
    "sellingPrice" DECIMAL(65,30),
    "isAvailableForPos" BOOLEAN NOT NULL DEFAULT false,
    "posProductId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nameNeedsAI" BOOLEAN NOT NULL DEFAULT false,
    "syncJobId" INTEGER,

    CONSTRAINT "PRD_Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PRD_ProductHistory" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "modelNo" TEXT,
    "specification" TEXT,
    "unitPerInner" INTEGER,
    "unitPerCarton" INTEGER,
    "cbm" DECIMAL(65,30),
    "grossWeight" DECIMAL(65,30),
    "netWeight" DECIMAL(65,30),
    "unit" TEXT,
    "unitCost" DECIMAL(65,30),
    "currency" TEXT,
    "sourceType" TEXT NOT NULL,
    "poOrderId" INTEGER,
    "poOrderNo" TEXT,
    "changedBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PRD_ProductHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PRN_ChargeTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PRN_ChargeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PRN_ChargeTemplateItem" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "calcType" TEXT NOT NULL,
    "calcBase" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "currency" TEXT,
    "accountCategory" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PRN_ChargeTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PRN_CustomerDefault" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "docType" TEXT NOT NULL,
    "freeFields" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PRN_CustomerDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PRN_Template" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "fieldMap" JSONB NOT NULL,
    "freeFields" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sealPlacements" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PRN_Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SLS" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "currencyCode" TEXT DEFAULT 'USD',
    "shipmentNo" TEXT NOT NULL,
    "actualShipDate" TIMESTAMP(3),
    "shippingMethod" TEXT,
    "portOfLoading" TEXT,
    "portOfDischarge" TEXT,
    "trackingNo" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "performedBy" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patiscoDocId" TEXT,
    "patiscoDocNo" TEXT,
    "syncJobId" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "poOrderId" INTEGER,
    "doCreatedDate" TIMESTAMP(3),
    "doExpiredDate" TIMESTAMP(3),
    "doCompletedDate" TIMESTAMP(3),
    "packingListNo" TEXT,
    "commercialInvNo" TEXT,
    "ciExchangeRate" DECIMAL(65,30),
    "ciAdditionalChargesForeign" DECIMAL(65,30),
    "ciExtraCharges" JSONB,
    "note" TEXT,
    "soNo" TEXT,
    "vesselVoyage" TEXT,
    "shippingLine" TEXT,
    "customsClosingDate" TIMESTAMP(3),
    "soEtd" TIMESTAMP(3),
    "soEta" TIMESTAMP(3),
    "containerYard" TEXT,
    "placeOfReceipt" TEXT,
    "warehouseInFrom" TIMESTAMP(3),
    "warehouseInUntil" TIMESTAMP(3),
    "forwarderName" TEXT,
    "forwarderContact" TEXT,
    "soNote" TEXT,
    "shippingMarks" TEXT,

    CONSTRAINT "SLS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SLS_DeliveryNote" (
    "id" SERIAL NOT NULL,
    "docNo" TEXT NOT NULL,
    "customerId" INTEGER,
    "slsPiId" INTEGER,
    "slsOrderId" INTEGER,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "contactName" TEXT,
    "contactPhone" TEXT,
    "deliveryAddr" TEXT,
    "freightCo" TEXT,
    "vehicleNo" TEXT,
    "shippingMark" TEXT,
    "note" TEXT,
    "counterpartNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "performedBy" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SLS_DeliveryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SLS_DeliveryNoteItem" (
    "id" SERIAL NOT NULL,
    "deliveryNoteId" INTEGER NOT NULL,
    "productId" INTEGER,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT,
    "cartons" INTEGER,
    "grossWeightKg" DECIMAL(65,30),

    CONSTRAINT "SLS_DeliveryNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SLS_FobCostAllocation" (
    "id" SERIAL NOT NULL,
    "costItemId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "poId" INTEGER,
    "grossWeightKg" DECIMAL(65,30) NOT NULL,
    "weightPct" DECIMAL(65,30) NOT NULL,
    "allocatedTWD" DECIMAL(65,30) NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "payableId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SLS_FobCostAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SLS_FobCostItem" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amountTWD" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SLS_FobCostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SLS_Item" (
    "id" SERIAL NOT NULL,
    "unitPrice" DECIMAL(65,30),
    "quantity" INTEGER NOT NULL,
    "unit" TEXT,
    "cartonNoFrom" TEXT,
    "cartonNoTo" TEXT,
    "cartons" INTEGER,
    "cbm" DECIMAL(65,30),
    "cubicFt" DECIMAL(65,30),
    "grossWeightKg" DECIMAL(65,30),
    "netWeightKg" DECIMAL(65,30),
    "piId" INTEGER,
    "rawProductName" TEXT,
    "rawSku" TEXT,
    "shipmentId" INTEGER NOT NULL,
    "slsItemId" INTEGER,

    CONSTRAINT "SLS_Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SLS_PI_Link" (
    "shipmentId" INTEGER NOT NULL,
    "piId" INTEGER NOT NULL,

    CONSTRAINT "SLS_PI_Link_pkey" PRIMARY KEY ("shipmentId","piId")
);

-- CreateTable
CREATE TABLE "public"."SUP_Contact" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "phoneNo" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SUP_Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SUP_Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "countryCode" TEXT,
    "postalCode" TEXT,
    "phoneNo" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "taxId" TEXT,
    "paymentTerms" TEXT,
    "currencyCode" TEXT,
    "note" TEXT,
    "patiscoSupplierId" TEXT,
    "defaultTradeTerms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentCycleDays" INTEGER,
    "chargeTemplateId" INTEGER,
    "syncJobId" INTEGER,

    CONSTRAINT "SUP_Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SUP_SupplierProduct" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "supplierSku" TEXT,
    "unitPrice" DECIMAL(65,30),
    "currencyCode" TEXT,
    "moq" INTEGER,
    "leadTimeDays" INTEGER,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SUP_SupplierProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SYS_Company" (
    "id" SERIAL NOT NULL,
    "inventoryMethod" TEXT NOT NULL DEFAULT 'WAC',
    "nameZh" TEXT NOT NULL DEFAULT '',
    "nameEn" TEXT NOT NULL DEFAULT '',
    "shortName" TEXT NOT NULL DEFAULT '',
    "addressZh" TEXT NOT NULL DEFAULT '',
    "addressEn" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "countryCode" TEXT NOT NULL DEFAULT 'TW',
    "phone" TEXT NOT NULL DEFAULT '',
    "fax" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "bankSwift" TEXT NOT NULL DEFAULT '',
    "customFields" JSONB NOT NULL DEFAULT '[]',
    "logoBase64" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SYS_Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SYS_CompanyAlias" (
    "id" SERIAL NOT NULL,
    "alias" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "customerId" INTEGER,
    "supplierId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SYS_CompanyAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SYS_Currency" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchangeRate" DECIMAL(65,30) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SYS_Currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "public"."SYS_DataAlert" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" INTEGER,
    "refNo" TEXT,
    "message" TEXT NOT NULL,
    "detail" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" INTEGER,
    "syncJobId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SYS_DataAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SYS_EmailConfig" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "encryptedApiKey" TEXT,
    "fromEmail" TEXT NOT NULL DEFAULT '',
    "fromName" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMsg" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SYS_EmailConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SYS_KeyValue" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SYS_KeyValue_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."SYS_PasswordReset" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SYS_PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SYS_PatiscoConfig" (
    "id" SERIAL NOT NULL,
    "mcpUrl" TEXT NOT NULL DEFAULT 'https://mcp.patisco.com',
    "username" TEXT,
    "encryptedPass" TEXT,
    "encryptedJwt" TEXT,
    "apiKey" TEXT,
    "userId" TEXT,
    "jwtExpiresAt" TIMESTAMP(3),
    "webhookSecret" TEXT,
    "cronSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMsg" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SYS_PatiscoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SYS_PatiscoSync" (
    "id" SERIAL NOT NULL,
    "docType" TEXT NOT NULL,
    "patiscoDocId" TEXT NOT NULL,
    "patiscoDocNo" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "errorMsg" TEXT,
    "analyzedResult" JSONB,
    "patiscoModifiedAt" TIMESTAMP(3),
    "syncJobId" INTEGER,

    CONSTRAINT "SYS_PatiscoSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SYS_PriceAdjustRule" (
    "id" SERIAL NOT NULL,
    "fromTerms" INTEGER NOT NULL,
    "toTerms" INTEGER NOT NULL,
    "adjustmentPct" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SYS_PriceAdjustRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SYS_Seal" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "imageBase64" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SYS_Seal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SYS_SettingAuditLog" (
    "id" SERIAL NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "changedBy" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SYS_SettingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SYS_SyncJob" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "trigger" TEXT NOT NULL,
    "phase1Total" INTEGER NOT NULL DEFAULT 0,
    "phase1Done" INTEGER NOT NULL DEFAULT 0,
    "phase2Step" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "errorAt" TIMESTAMP(3),
    "errorMsg" TEXT,
    "result" JSONB,
    "performedBy" INTEGER,

    CONSTRAINT "SYS_SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SYS_User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'zh-TW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiProvider" TEXT,
    "encryptedAiKey" TEXT,
    "aiParseModel" TEXT,

    CONSTRAINT "SYS_User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UPS_Shipment" (
    "id" SERIAL NOT NULL,
    "slsId" INTEGER NOT NULL,
    "shipDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'created',
    "packageCount" INTEGER,
    "trackingNos" JSONB,
    "labelEmailTo" TEXT,
    "labelEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,

    CONSTRAINT "UPS_Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UPS_ShipmentLog" (
    "id" SERIAL NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "upsShipmentId" TEXT,
    "serviceCode" TEXT NOT NULL,
    "serviceName" TEXT,
    "piId" INTEGER,
    "piNo" TEXT,
    "originSnapshot" JSONB NOT NULL,
    "destinationSnapshot" JSONB NOT NULL,
    "packagesSnapshot" JSONB NOT NULL,
    "declaredValue" DECIMAL(65,30),
    "declaredCurrency" TEXT,
    "chargedAmount" DECIMAL(65,30),
    "chargedCurrency" TEXT,
    "labelBase64" TEXT,
    "labelFormat" TEXT DEFAULT 'GIF',
    "pickupConfirmationNo" TEXT,
    "pickupReadyTime" TIMESTAMP(3),
    "pickupCloseTime" TIMESTAMP(3),
    "pickupScheduledDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" INTEGER,

    CONSTRAINT "UPS_ShipmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "COST_Sheet_productId_idx" ON "public"."COST_Sheet"("productId" ASC);

-- CreateIndex
CREATE INDEX "CUS_Contact_customerId_idx" ON "public"."CUS_Contact"("customerId" ASC);

-- CreateIndex
CREATE INDEX "CUS_Customer_name_idx" ON "public"."CUS_Customer"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CUS_CustomerProduct_customerId_productId_key" ON "public"."CUS_CustomerProduct"("customerId" ASC, "productId" ASC);

-- CreateIndex
CREATE INDEX "CUS_CustomerProduct_productId_idx" ON "public"."CUS_CustomerProduct"("productId" ASC);

-- CreateIndex
CREATE INDEX "FIN_Payable_dueDate_idx" ON "public"."FIN_Payable"("dueDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FIN_Payable_receiptId_key" ON "public"."FIN_Payable"("receiptId" ASC);

-- CreateIndex
CREATE INDEX "FIN_Payable_shipmentId_idx" ON "public"."FIN_Payable"("shipmentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FIN_Payable_shipmentId_poId_key" ON "public"."FIN_Payable"("shipmentId" ASC, "poId" ASC);

-- CreateIndex
CREATE INDEX "FIN_Payable_supplierId_idx" ON "public"."FIN_Payable"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "FIN_PaymentVoucher_status_idx" ON "public"."FIN_PaymentVoucher"("status" ASC);

-- CreateIndex
CREATE INDEX "FIN_PaymentVoucher_supplierId_idx" ON "public"."FIN_PaymentVoucher"("supplierId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FIN_PaymentVoucher_voucherNo_key" ON "public"."FIN_PaymentVoucher"("voucherNo" ASC);

-- CreateIndex
CREATE INDEX "FIN_PaymentVoucherAdjustment_voucherId_idx" ON "public"."FIN_PaymentVoucherAdjustment"("voucherId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FIN_PaymentVoucherItem_payableId_key" ON "public"."FIN_PaymentVoucherItem"("payableId" ASC);

-- CreateIndex
CREATE INDEX "FIN_PaymentVoucherItem_voucherId_idx" ON "public"."FIN_PaymentVoucherItem"("voucherId" ASC);

-- CreateIndex
CREATE INDEX "FIN_Receivable_customerId_idx" ON "public"."FIN_Receivable"("customerId" ASC);

-- CreateIndex
CREATE INDEX "FIN_Receivable_dueDate_idx" ON "public"."FIN_Receivable"("dueDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FIN_Receivable_shipmentId_key" ON "public"."FIN_Receivable"("shipmentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "INV_Adjustment_adjustNo_key" ON "public"."INV_Adjustment"("adjustNo" ASC);

-- CreateIndex
CREATE INDEX "INV_Adjustment_productId_idx" ON "public"."INV_Adjustment"("productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "INV_Movement_adjustmentId_key" ON "public"."INV_Movement"("adjustmentId" ASC);

-- CreateIndex
CREATE INDEX "INV_Movement_patiscoDocType_patiscoDocId_idx" ON "public"."INV_Movement"("patiscoDocType" ASC, "patiscoDocId" ASC);

-- CreateIndex
CREATE INDEX "INV_Movement_productId_createdAt_idx" ON "public"."INV_Movement"("productId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "INV_Movement_receiptId_idx" ON "public"."INV_Movement"("receiptId" ASC);

-- CreateIndex
CREATE INDEX "INV_Movement_slsPiId_idx" ON "public"."INV_Movement"("slsPiId" ASC);

-- CreateIndex
CREATE INDEX "INV_Movement_slsShipmentId_idx" ON "public"."INV_Movement"("slsShipmentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "INV_Stock_productId_key" ON "public"."INV_Stock"("productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MKT_Order_channelId_platformOrderNo_key" ON "public"."MKT_Order"("channelId" ASC, "platformOrderNo" ASC);

-- CreateIndex
CREATE INDEX "MKT_Order_channelId_status_idx" ON "public"."MKT_Order"("channelId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MKT_SkuMapping_channelId_platformSku_key" ON "public"."MKT_SkuMapping"("channelId" ASC, "platformSku" ASC);

-- CreateIndex
CREATE INDEX "MKT_SyncLog_channelId_createdAt_idx" ON "public"."MKT_SyncLog"("channelId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PI_orderId_idx" ON "public"."PI"("orderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PI_piNo_key" ON "public"."PI"("piNo" ASC);

-- CreateIndex
CREATE INDEX "PI_Item_piId_idx" ON "public"."PI_Item"("piId" ASC);

-- CreateIndex
CREATE INDEX "PI_SupplierCopy_orderId_idx" ON "public"."PI_SupplierCopy"("orderId" ASC);

-- CreateIndex
CREATE INDEX "PI_SupplierCopy_Item_supplierPIId_idx" ON "public"."PI_SupplierCopy_Item"("supplierPIId" ASC);

-- CreateIndex
CREATE INDEX "PO_archivedAt_idx" ON "public"."PO"("archivedAt" ASC);

-- CreateIndex
CREATE INDEX "PO_poNo_idx" ON "public"."PO"("poNo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PO_poNo_key" ON "public"."PO"("poNo" ASC);

-- CreateIndex
CREATE INDEX "PO_salesOrderId_idx" ON "public"."PO"("salesOrderId" ASC);

-- CreateIndex
CREATE INDEX "PO_slsPiId_idx" ON "public"."PO"("slsPiId" ASC);

-- CreateIndex
CREATE INDEX "PO_supplierId_status_idx" ON "public"."PO"("supplierId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "PO_CustomerCopy_archivedAt_idx" ON "public"."PO_CustomerCopy"("archivedAt" ASC);

-- CreateIndex
CREATE INDEX "PO_CustomerCopy_customerId_status_idx" ON "public"."PO_CustomerCopy"("customerId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "PO_CustomerCopy_orderNo_idx" ON "public"."PO_CustomerCopy"("orderNo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PO_CustomerCopy_orderNo_key" ON "public"."PO_CustomerCopy"("orderNo" ASC);

-- CreateIndex
CREATE INDEX "PO_CustomerCopy_Item_orderId_idx" ON "public"."PO_CustomerCopy_Item"("orderId" ASC);

-- CreateIndex
CREATE INDEX "PO_CustomerCopy_Item_productId_idx" ON "public"."PO_CustomerCopy_Item"("productId" ASC);

-- CreateIndex
CREATE INDEX "PO_Item_orderId_idx" ON "public"."PO_Item"("orderId" ASC);

-- CreateIndex
CREATE INDEX "PO_Item_productId_idx" ON "public"."PO_Item"("productId" ASC);

-- CreateIndex
CREATE INDEX "PO_Receipt_orderId_idx" ON "public"."PO_Receipt"("orderId" ASC);

-- CreateIndex
CREATE INDEX "PO_ReceiptItem_receiptId_idx" ON "public"."PO_ReceiptItem"("receiptId" ASC);

-- CreateIndex
CREATE INDEX "PO_ShippingNotice_issueDate_idx" ON "public"."PO_ShippingNotice"("issueDate" ASC);

-- CreateIndex
CREATE INDEX "PO_ShippingNotice_noticeNo_idx" ON "public"."PO_ShippingNotice"("noticeNo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PO_ShippingNotice_noticeNo_key" ON "public"."PO_ShippingNotice"("noticeNo" ASC);

-- CreateIndex
CREATE INDEX "PO_ShippingNotice_sourceShipmentId_idx" ON "public"."PO_ShippingNotice"("sourceShipmentId" ASC);

-- CreateIndex
CREATE INDEX "PO_ShippingNotice_supplierId_status_idx" ON "public"."PO_ShippingNotice"("supplierId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "PO_ShippingNoticeItem_noticeId_idx" ON "public"."PO_ShippingNoticeItem"("noticeId" ASC);

-- CreateIndex
CREATE INDEX "PO_ShippingNoticeItem_poId_idx" ON "public"."PO_ShippingNoticeItem"("poId" ASC);

-- CreateIndex
CREATE INDEX "PO_ShippingNoticeItem_productId_idx" ON "public"."PO_ShippingNoticeItem"("productId" ASC);

-- CreateIndex
CREATE INDEX "PRD_Product_modelNo_idx" ON "public"."PRD_Product"("modelNo" ASC);

-- CreateIndex
CREATE INDEX "PRD_Product_sku_idx" ON "public"."PRD_Product"("sku" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PRD_Product_sku_key" ON "public"."PRD_Product"("sku" ASC);

-- CreateIndex
CREATE INDEX "PRD_ProductHistory_productId_createdAt_idx" ON "public"."PRD_ProductHistory"("productId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PRN_ChargeTemplateItem_templateId_idx" ON "public"."PRN_ChargeTemplateItem"("templateId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PRN_CustomerDefault_customerId_docType_key" ON "public"."PRN_CustomerDefault"("customerId" ASC, "docType" ASC);

-- CreateIndex
CREATE INDEX "PRN_CustomerDefault_customerId_idx" ON "public"."PRN_CustomerDefault"("customerId" ASC);

-- CreateIndex
CREATE INDEX "PRN_Template_docType_idx" ON "public"."PRN_Template"("docType" ASC);

-- CreateIndex
CREATE INDEX "SLS_customerId_idx" ON "public"."SLS"("customerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SLS_shipmentNo_key" ON "public"."SLS"("shipmentNo" ASC);

-- CreateIndex
CREATE INDEX "SLS_DeliveryNote_customerId_idx" ON "public"."SLS_DeliveryNote"("customerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SLS_DeliveryNote_docNo_key" ON "public"."SLS_DeliveryNote"("docNo" ASC);

-- CreateIndex
CREATE INDEX "SLS_DeliveryNote_slsOrderId_idx" ON "public"."SLS_DeliveryNote"("slsOrderId" ASC);

-- CreateIndex
CREATE INDEX "SLS_DeliveryNote_slsPiId_idx" ON "public"."SLS_DeliveryNote"("slsPiId" ASC);

-- CreateIndex
CREATE INDEX "SLS_DeliveryNoteItem_deliveryNoteId_idx" ON "public"."SLS_DeliveryNoteItem"("deliveryNoteId" ASC);

-- CreateIndex
CREATE INDEX "SLS_FobCostAllocation_costItemId_idx" ON "public"."SLS_FobCostAllocation"("costItemId" ASC);

-- CreateIndex
CREATE INDEX "SLS_FobCostAllocation_supplierId_idx" ON "public"."SLS_FobCostAllocation"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "SLS_FobCostItem_shipmentId_idx" ON "public"."SLS_FobCostItem"("shipmentId" ASC);

-- CreateIndex
CREATE INDEX "SLS_Item_piId_idx" ON "public"."SLS_Item"("piId" ASC);

-- CreateIndex
CREATE INDEX "SLS_Item_shipmentId_idx" ON "public"."SLS_Item"("shipmentId" ASC);

-- CreateIndex
CREATE INDEX "SLS_PI_Link_piId_idx" ON "public"."SLS_PI_Link"("piId" ASC);

-- CreateIndex
CREATE INDEX "SUP_Contact_supplierId_idx" ON "public"."SUP_Contact"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "SUP_Supplier_name_idx" ON "public"."SUP_Supplier"("name" ASC);

-- CreateIndex
CREATE INDEX "SUP_SupplierProduct_productId_idx" ON "public"."SUP_SupplierProduct"("productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SUP_SupplierProduct_supplierId_productId_key" ON "public"."SUP_SupplierProduct"("supplierId" ASC, "productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SYS_CompanyAlias_alias_key" ON "public"."SYS_CompanyAlias"("alias" ASC);

-- CreateIndex
CREATE INDEX "SYS_CompanyAlias_role_idx" ON "public"."SYS_CompanyAlias"("role" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SYS_PasswordReset_token_key" ON "public"."SYS_PasswordReset"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SYS_PatiscoSync_docType_patiscoDocId_key" ON "public"."SYS_PatiscoSync"("docType" ASC, "patiscoDocId" ASC);

-- CreateIndex
CREATE INDEX "SYS_PatiscoSync_docType_status_idx" ON "public"."SYS_PatiscoSync"("docType" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "SYS_PatiscoSync_syncJobId_idx" ON "public"."SYS_PatiscoSync"("syncJobId" ASC);

-- CreateIndex
CREATE INDEX "SYS_PatiscoSync_syncedAt_idx" ON "public"."SYS_PatiscoSync"("syncedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SYS_PriceAdjustRule_fromTerms_toTerms_key" ON "public"."SYS_PriceAdjustRule"("fromTerms" ASC, "toTerms" ASC);

-- CreateIndex
CREATE INDEX "SYS_SettingAuditLog_field_changedAt_idx" ON "public"."SYS_SettingAuditLog"("field" ASC, "changedAt" ASC);

-- CreateIndex
CREATE INDEX "SYS_SyncJob_status_startedAt_idx" ON "public"."SYS_SyncJob"("status" ASC, "startedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SYS_User_loginId_key" ON "public"."SYS_User"("loginId" ASC);

-- CreateIndex
CREATE INDEX "UPS_Shipment_slsId_idx" ON "public"."UPS_Shipment"("slsId" ASC);

-- CreateIndex
CREATE INDEX "UPS_ShipmentLog_createdAt_idx" ON "public"."UPS_ShipmentLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "UPS_ShipmentLog_piNo_idx" ON "public"."UPS_ShipmentLog"("piNo" ASC);

-- CreateIndex
CREATE INDEX "UPS_ShipmentLog_trackingNumber_idx" ON "public"."UPS_ShipmentLog"("trackingNumber" ASC);

-- AddForeignKey
ALTER TABLE "public"."COST_Sheet" ADD CONSTRAINT "COST_Sheet_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."COST_Sheet" ADD CONSTRAINT "COST_Sheet_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CUS_Contact" ADD CONSTRAINT "CUS_Contact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CUS_Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CUS_Customer" ADD CONSTRAINT "CUS_Customer_chargeTemplateId_fkey" FOREIGN KEY ("chargeTemplateId") REFERENCES "public"."PRN_ChargeTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CUS_CustomerProduct" ADD CONSTRAINT "CUS_CustomerProduct_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CUS_Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CUS_CustomerProduct" ADD CONSTRAINT "CUS_CustomerProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FIN_Payable" ADD CONSTRAINT "FIN_Payable_batchPayableId_fkey" FOREIGN KEY ("batchPayableId") REFERENCES "public"."FIN_Payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FIN_Payable" ADD CONSTRAINT "FIN_Payable_poId_fkey" FOREIGN KEY ("poId") REFERENCES "public"."PO"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FIN_Payable" ADD CONSTRAINT "FIN_Payable_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."PO_Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FIN_Payable" ADD CONSTRAINT "FIN_Payable_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."SLS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FIN_Payable" ADD CONSTRAINT "FIN_Payable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FIN_PaymentVoucher" ADD CONSTRAINT "FIN_PaymentVoucher_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FIN_PaymentVoucherAdjustment" ADD CONSTRAINT "FIN_PaymentVoucherAdjustment_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "public"."FIN_PaymentVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FIN_PaymentVoucherItem" ADD CONSTRAINT "FIN_PaymentVoucherItem_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "public"."FIN_Payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FIN_PaymentVoucherItem" ADD CONSTRAINT "FIN_PaymentVoucherItem_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "public"."FIN_PaymentVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FIN_Receivable" ADD CONSTRAINT "FIN_Receivable_batchReceivableId_fkey" FOREIGN KEY ("batchReceivableId") REFERENCES "public"."FIN_Receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FIN_Receivable" ADD CONSTRAINT "FIN_Receivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CUS_Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FIN_Receivable" ADD CONSTRAINT "FIN_Receivable_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."SLS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."INV_Adjustment" ADD CONSTRAINT "INV_Adjustment_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "public"."SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."INV_Adjustment" ADD CONSTRAINT "INV_Adjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."INV_Movement" ADD CONSTRAINT "INV_Movement_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "public"."INV_Adjustment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."INV_Movement" ADD CONSTRAINT "INV_Movement_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "public"."SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."INV_Movement" ADD CONSTRAINT "INV_Movement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."INV_Movement" ADD CONSTRAINT "INV_Movement_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."PO_Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."INV_Movement" ADD CONSTRAINT "INV_Movement_slsPiId_fkey" FOREIGN KEY ("slsPiId") REFERENCES "public"."PI"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."INV_Movement" ADD CONSTRAINT "INV_Movement_slsShipmentId_fkey" FOREIGN KEY ("slsShipmentId") REFERENCES "public"."SLS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."INV_Stock" ADD CONSTRAINT "INV_Stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MKT_Order" ADD CONSTRAINT "MKT_Order_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."MKT_Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MKT_Order" ADD CONSTRAINT "MKT_Order_slsOrderId_fkey" FOREIGN KEY ("slsOrderId") REFERENCES "public"."PO_CustomerCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MKT_OrderItem" ADD CONSTRAINT "MKT_OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."MKT_Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MKT_SkuMapping" ADD CONSTRAINT "MKT_SkuMapping_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."MKT_Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MKT_SkuMapping" ADD CONSTRAINT "MKT_SkuMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MKT_SyncLog" ADD CONSTRAINT "MKT_SyncLog_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."MKT_Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PI" ADD CONSTRAINT "PI_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CUS_Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PI" ADD CONSTRAINT "PI_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."PO_CustomerCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PI" ADD CONSTRAINT "PI_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "public"."SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PI_Item" ADD CONSTRAINT "PI_Item_piId_fkey" FOREIGN KEY ("piId") REFERENCES "public"."PI"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PI_Item" ADD CONSTRAINT "PI_Item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PI_Item" ADD CONSTRAINT "PI_Item_slsItemId_fkey" FOREIGN KEY ("slsItemId") REFERENCES "public"."PO_CustomerCopy_Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PI_SupplierCopy" ADD CONSTRAINT "PI_SupplierCopy_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."PO"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PI_SupplierCopy" ADD CONSTRAINT "PI_SupplierCopy_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "public"."SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PI_SupplierCopy_Item" ADD CONSTRAINT "PI_SupplierCopy_Item_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "public"."PO_Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PI_SupplierCopy_Item" ADD CONSTRAINT "PI_SupplierCopy_Item_supplierPIId_fkey" FOREIGN KEY ("supplierPIId") REFERENCES "public"."PI_SupplierCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO" ADD CONSTRAINT "PO_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO" ADD CONSTRAINT "PO_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "public"."PO_CustomerCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO" ADD CONSTRAINT "PO_slsPiId_fkey" FOREIGN KEY ("slsPiId") REFERENCES "public"."PI"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO" ADD CONSTRAINT "PO_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_CustomerCopy" ADD CONSTRAINT "PO_CustomerCopy_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_CustomerCopy" ADD CONSTRAINT "PO_CustomerCopy_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CUS_Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_CustomerCopy" ADD CONSTRAINT "PO_CustomerCopy_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "public"."SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_CustomerCopy_Item" ADD CONSTRAINT "PO_CustomerCopy_Item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."PO_CustomerCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_CustomerCopy_Item" ADD CONSTRAINT "PO_CustomerCopy_Item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_Item" ADD CONSTRAINT "PO_Item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."PO"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_Item" ADD CONSTRAINT "PO_Item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_Receipt" ADD CONSTRAINT "PO_Receipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."PO"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_Receipt" ADD CONSTRAINT "PO_Receipt_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "public"."SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_ReceiptItem" ADD CONSTRAINT "PO_ReceiptItem_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "public"."PO_Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_ReceiptItem" ADD CONSTRAINT "PO_ReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."PO_Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_ShippingNotice" ADD CONSTRAINT "PO_ShippingNotice_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "public"."SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_ShippingNotice" ADD CONSTRAINT "PO_ShippingNotice_sourceShipmentId_fkey" FOREIGN KEY ("sourceShipmentId") REFERENCES "public"."SLS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_ShippingNotice" ADD CONSTRAINT "PO_ShippingNotice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_ShippingNoticeItem" ADD CONSTRAINT "PO_ShippingNoticeItem_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "public"."PO_ShippingNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_ShippingNoticeItem" ADD CONSTRAINT "PO_ShippingNoticeItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "public"."PO"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PO_ShippingNoticeItem" ADD CONSTRAINT "PO_ShippingNoticeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PRD_Category" ADD CONSTRAINT "PRD_Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."PRD_Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PRD_CategoryMapping" ADD CONSTRAINT "PRD_CategoryMapping_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."PRD_Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PRD_CategoryMapping" ADD CONSTRAINT "PRD_CategoryMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PRD_ProductHistory" ADD CONSTRAINT "PRD_ProductHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "public"."SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PRD_ProductHistory" ADD CONSTRAINT "PRD_ProductHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PRN_ChargeTemplateItem" ADD CONSTRAINT "PRN_ChargeTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."PRN_ChargeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PRN_CustomerDefault" ADD CONSTRAINT "PRN_CustomerDefault_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CUS_Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS" ADD CONSTRAINT "SLS_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CUS_Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS" ADD CONSTRAINT "SLS_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "public"."SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS" ADD CONSTRAINT "SLS_poOrderId_fkey" FOREIGN KEY ("poOrderId") REFERENCES "public"."PO"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_DeliveryNote" ADD CONSTRAINT "SLS_DeliveryNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CUS_Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_DeliveryNote" ADD CONSTRAINT "SLS_DeliveryNote_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "public"."SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_DeliveryNote" ADD CONSTRAINT "SLS_DeliveryNote_slsOrderId_fkey" FOREIGN KEY ("slsOrderId") REFERENCES "public"."PO_CustomerCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_DeliveryNote" ADD CONSTRAINT "SLS_DeliveryNote_slsPiId_fkey" FOREIGN KEY ("slsPiId") REFERENCES "public"."PI"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_DeliveryNoteItem" ADD CONSTRAINT "SLS_DeliveryNoteItem_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "public"."SLS_DeliveryNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_DeliveryNoteItem" ADD CONSTRAINT "SLS_DeliveryNoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_FobCostAllocation" ADD CONSTRAINT "SLS_FobCostAllocation_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "public"."SLS_FobCostItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_FobCostAllocation" ADD CONSTRAINT "SLS_FobCostAllocation_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "public"."FIN_Payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_FobCostAllocation" ADD CONSTRAINT "SLS_FobCostAllocation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_FobCostItem" ADD CONSTRAINT "SLS_FobCostItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."SLS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_Item" ADD CONSTRAINT "SLS_Item_piId_fkey" FOREIGN KEY ("piId") REFERENCES "public"."PI"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_Item" ADD CONSTRAINT "SLS_Item_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."SLS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_Item" ADD CONSTRAINT "SLS_Item_slsItemId_fkey" FOREIGN KEY ("slsItemId") REFERENCES "public"."PO_CustomerCopy_Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_PI_Link" ADD CONSTRAINT "SLS_PI_Link_piId_fkey" FOREIGN KEY ("piId") REFERENCES "public"."PI"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SLS_PI_Link" ADD CONSTRAINT "SLS_PI_Link_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."SLS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SUP_Contact" ADD CONSTRAINT "SUP_Contact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SUP_Supplier" ADD CONSTRAINT "SUP_Supplier_chargeTemplateId_fkey" FOREIGN KEY ("chargeTemplateId") REFERENCES "public"."PRN_ChargeTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SUP_SupplierProduct" ADD CONSTRAINT "SUP_SupplierProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SUP_SupplierProduct" ADD CONSTRAINT "SUP_SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SYS_CompanyAlias" ADD CONSTRAINT "SYS_CompanyAlias_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CUS_Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SYS_CompanyAlias" ADD CONSTRAINT "SYS_CompanyAlias_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."SUP_Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SYS_PasswordReset" ADD CONSTRAINT "SYS_PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SYS_SettingAuditLog" ADD CONSTRAINT "SYS_SettingAuditLog_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "public"."SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SYS_SyncJob" ADD CONSTRAINT "SYS_SyncJob_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "public"."SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UPS_Shipment" ADD CONSTRAINT "UPS_Shipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UPS_Shipment" ADD CONSTRAINT "UPS_Shipment_slsId_fkey" FOREIGN KEY ("slsId") REFERENCES "public"."SLS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

