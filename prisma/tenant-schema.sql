-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "SYS_PatiscoConfig" (
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
CREATE TABLE "SYS_PatiscoSync" (
    "id" SERIAL NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'PI',
    "patiscoDocId" TEXT NOT NULL,
    "patiscoDocNo" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "errorMsg" TEXT,

    CONSTRAINT "SYS_PatiscoSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SYS_User" (
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
CREATE TABLE "SYS_SettingAuditLog" (
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
CREATE TABLE "SYS_Company" (
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
CREATE TABLE "SYS_CompanyAlias" (
    "id" SERIAL NOT NULL,
    "alias" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "customerId" INTEGER,
    "supplierId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SYS_CompanyAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SYS_EmailConfig" (
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
CREATE TABLE "SYS_PasswordReset" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SYS_PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SYS_Currency" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchangeRate" DECIMAL(65,30) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SYS_Currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "SYS_PriceAdjustRule" (
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
CREATE TABLE "PRD_Product" (
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

    CONSTRAINT "PRD_Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRD_ProductHistory" (
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
CREATE TABLE "PRD_Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,

    CONSTRAINT "PRD_Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRD_CategoryMapping" (
    "productId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "PRD_CategoryMapping_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "SUP_Supplier" (
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

    CONSTRAINT "SUP_Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SUP_Contact" (
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
CREATE TABLE "SUP_SupplierProduct" (
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
CREATE TABLE "CUS_CustomerProduct" (
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
CREATE TABLE "CUS_Customer" (
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

    CONSTRAINT "CUS_Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CUS_Contact" (
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
CREATE TABLE "PO_Order" (
    "id" SERIAL NOT NULL,
    "poNo" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
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
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "PO_Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PO_Item" (
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
CREATE TABLE "PO_SupplierPI" (
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

    CONSTRAINT "PO_SupplierPI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PO_SupplierPIItem" (
    "id" SERIAL NOT NULL,
    "supplierPIId" INTEGER NOT NULL,
    "poItemId" INTEGER NOT NULL,
    "confirmedQty" INTEGER NOT NULL,

    CONSTRAINT "PO_SupplierPIItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PO_Receipt" (
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
CREATE TABLE "PO_ReceiptItem" (
    "id" SERIAL NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "poItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PO_ReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLS_Order" (
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
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "SLS_Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLS_Item" (
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

    CONSTRAINT "SLS_Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLS_PI" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "piNo" TEXT NOT NULL,
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

    CONSTRAINT "SLS_PI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLS_PIItem" (
    "id" SERIAL NOT NULL,
    "piId" INTEGER NOT NULL,
    "slsItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30),
    "unit" TEXT,
    "unitPerCarton" INTEGER,
    "cbm" DECIMAL(65,30),
    "grossWeight" DECIMAL(65,30),
    "netWeight" DECIMAL(65,30),

    CONSTRAINT "SLS_PIItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLS_Shipment" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "currencyCode" TEXT DEFAULT 'USD',
    "shipmentNo" TEXT NOT NULL,
    "actualShipDate" TIMESTAMP(3) NOT NULL,
    "shippingMethod" TEXT,
    "portOfLoading" TEXT,
    "portOfDischarge" TEXT,
    "trackingNo" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "performedBy" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patiscoDocId" TEXT,
    "patiscoDocNo" TEXT,
    "packingListNo" TEXT,
    "commercialInvNo" TEXT,
    "ciExchangeRate" DECIMAL(65,30),
    "note" TEXT,

    CONSTRAINT "SLS_Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLS_ShipmentPI" (
    "shipmentId" INTEGER NOT NULL,
    "piId" INTEGER NOT NULL,

    CONSTRAINT "SLS_ShipmentPI_pkey" PRIMARY KEY ("shipmentId","piId")
);

-- CreateTable
CREATE TABLE "SLS_ShipmentItem" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "slsItemId" INTEGER,
    "piId" INTEGER,
    "rawSku" TEXT,
    "rawProductName" TEXT,
    "quantity" INTEGER NOT NULL,
    "cartons" INTEGER,
    "cartonNoFrom" TEXT,
    "cartonNoTo" TEXT,
    "grossWeightKg" DECIMAL(65,30),
    "netWeightKg" DECIMAL(65,30),
    "cubicFt" DECIMAL(65,30),
    "cbm" DECIMAL(65,30),

    CONSTRAINT "SLS_ShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "INV_Stock" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "INV_Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "INV_Adjustment" (
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
CREATE TABLE "INV_Movement" (
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
CREATE TABLE "COST_Sheet" (
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
CREATE TABLE "FIN_Payable" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "receiptId" INTEGER NOT NULL,
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

    CONSTRAINT "FIN_Payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FIN_Receivable" (
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

    CONSTRAINT "FIN_Receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLS_FobCostItem" (
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
CREATE TABLE "SLS_FobCostAllocation" (
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
CREATE TABLE "UPS_ShipmentLog" (
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

-- CreateTable
CREATE TABLE "SYS_KeyValue" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SYS_KeyValue_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "MKT_Channel" (
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
CREATE TABLE "MKT_SkuMapping" (
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
CREATE TABLE "MKT_SyncLog" (
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
CREATE TABLE "MKT_Order" (
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
CREATE TABLE "MKT_OrderItem" (
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
CREATE TABLE "SLS_DeliveryNote" (
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
CREATE TABLE "SLS_DeliveryNoteItem" (
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
CREATE TABLE "FIN_PaymentVoucher" (
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
CREATE TABLE "FIN_PaymentVoucherItem" (
    "id" SERIAL NOT NULL,
    "voucherId" INTEGER NOT NULL,
    "payableId" INTEGER NOT NULL,
    "amountTWD" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "FIN_PaymentVoucherItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FIN_PaymentVoucherAdjustment" (
    "id" SERIAL NOT NULL,
    "voucherId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amountTWD" DECIMAL(65,30) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "note" TEXT,

    CONSTRAINT "FIN_PaymentVoucherAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRN_CustomerDefault" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "docType" TEXT NOT NULL,
    "freeFields" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PRN_CustomerDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRN_Template" (
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
CREATE TABLE "SYS_Seal" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "imageBase64" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SYS_Seal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRN_ChargeTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PRN_ChargeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRN_ChargeTemplateItem" (
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

-- CreateIndex
CREATE INDEX "SYS_PatiscoSync_syncedAt_idx" ON "SYS_PatiscoSync"("syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SYS_PatiscoSync_docType_patiscoDocId_key" ON "SYS_PatiscoSync"("docType", "patiscoDocId");

-- CreateIndex
CREATE UNIQUE INDEX "SYS_User_loginId_key" ON "SYS_User"("loginId");

-- CreateIndex
CREATE INDEX "SYS_SettingAuditLog_field_changedAt_idx" ON "SYS_SettingAuditLog"("field", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SYS_CompanyAlias_alias_key" ON "SYS_CompanyAlias"("alias");

-- CreateIndex
CREATE INDEX "SYS_CompanyAlias_role_idx" ON "SYS_CompanyAlias"("role");

-- CreateIndex
CREATE UNIQUE INDEX "SYS_PasswordReset_token_key" ON "SYS_PasswordReset"("token");

-- CreateIndex
CREATE UNIQUE INDEX "SYS_PriceAdjustRule_fromTerms_toTerms_key" ON "SYS_PriceAdjustRule"("fromTerms", "toTerms");

-- CreateIndex
CREATE UNIQUE INDEX "PRD_Product_sku_key" ON "PRD_Product"("sku");

-- CreateIndex
CREATE INDEX "PRD_Product_sku_idx" ON "PRD_Product"("sku");

-- CreateIndex
CREATE INDEX "PRD_Product_modelNo_idx" ON "PRD_Product"("modelNo");

-- CreateIndex
CREATE INDEX "PRD_ProductHistory_productId_createdAt_idx" ON "PRD_ProductHistory"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "SUP_Supplier_name_idx" ON "SUP_Supplier"("name");

-- CreateIndex
CREATE INDEX "SUP_Contact_supplierId_idx" ON "SUP_Contact"("supplierId");

-- CreateIndex
CREATE INDEX "SUP_SupplierProduct_productId_idx" ON "SUP_SupplierProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SUP_SupplierProduct_supplierId_productId_key" ON "SUP_SupplierProduct"("supplierId", "productId");

-- CreateIndex
CREATE INDEX "CUS_CustomerProduct_productId_idx" ON "CUS_CustomerProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CUS_CustomerProduct_customerId_productId_key" ON "CUS_CustomerProduct"("customerId", "productId");

-- CreateIndex
CREATE INDEX "CUS_Customer_name_idx" ON "CUS_Customer"("name");

-- CreateIndex
CREATE INDEX "CUS_Contact_customerId_idx" ON "CUS_Contact"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "PO_Order_poNo_key" ON "PO_Order"("poNo");

-- CreateIndex
CREATE INDEX "PO_Order_supplierId_status_idx" ON "PO_Order"("supplierId", "status");

-- CreateIndex
CREATE INDEX "PO_Order_poNo_idx" ON "PO_Order"("poNo");

-- CreateIndex
CREATE INDEX "PO_Order_salesOrderId_idx" ON "PO_Order"("salesOrderId");

-- CreateIndex
CREATE INDEX "PO_Order_archivedAt_idx" ON "PO_Order"("archivedAt");

-- CreateIndex
CREATE INDEX "PO_Item_orderId_idx" ON "PO_Item"("orderId");

-- CreateIndex
CREATE INDEX "PO_Item_productId_idx" ON "PO_Item"("productId");

-- CreateIndex
CREATE INDEX "PO_SupplierPI_orderId_idx" ON "PO_SupplierPI"("orderId");

-- CreateIndex
CREATE INDEX "PO_SupplierPIItem_supplierPIId_idx" ON "PO_SupplierPIItem"("supplierPIId");

-- CreateIndex
CREATE INDEX "PO_Receipt_orderId_idx" ON "PO_Receipt"("orderId");

-- CreateIndex
CREATE INDEX "PO_ReceiptItem_receiptId_idx" ON "PO_ReceiptItem"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "SLS_Order_orderNo_key" ON "SLS_Order"("orderNo");

-- CreateIndex
CREATE INDEX "SLS_Order_customerId_status_idx" ON "SLS_Order"("customerId", "status");

-- CreateIndex
CREATE INDEX "SLS_Order_orderNo_idx" ON "SLS_Order"("orderNo");

-- CreateIndex
CREATE INDEX "SLS_Order_archivedAt_idx" ON "SLS_Order"("archivedAt");

-- CreateIndex
CREATE INDEX "SLS_Item_orderId_idx" ON "SLS_Item"("orderId");

-- CreateIndex
CREATE INDEX "SLS_Item_productId_idx" ON "SLS_Item"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SLS_PI_piNo_key" ON "SLS_PI"("piNo");

-- CreateIndex
CREATE INDEX "SLS_PI_orderId_idx" ON "SLS_PI"("orderId");

-- CreateIndex
CREATE INDEX "SLS_PIItem_piId_idx" ON "SLS_PIItem"("piId");

-- CreateIndex
CREATE UNIQUE INDEX "SLS_Shipment_shipmentNo_key" ON "SLS_Shipment"("shipmentNo");

-- CreateIndex
CREATE INDEX "SLS_Shipment_customerId_idx" ON "SLS_Shipment"("customerId");

-- CreateIndex
CREATE INDEX "SLS_ShipmentPI_piId_idx" ON "SLS_ShipmentPI"("piId");

-- CreateIndex
CREATE INDEX "SLS_ShipmentItem_shipmentId_idx" ON "SLS_ShipmentItem"("shipmentId");

-- CreateIndex
CREATE INDEX "SLS_ShipmentItem_piId_idx" ON "SLS_ShipmentItem"("piId");

-- CreateIndex
CREATE UNIQUE INDEX "INV_Stock_productId_key" ON "INV_Stock"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "INV_Adjustment_adjustNo_key" ON "INV_Adjustment"("adjustNo");

-- CreateIndex
CREATE INDEX "INV_Adjustment_productId_idx" ON "INV_Adjustment"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "INV_Movement_adjustmentId_key" ON "INV_Movement"("adjustmentId");

-- CreateIndex
CREATE INDEX "INV_Movement_productId_createdAt_idx" ON "INV_Movement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "INV_Movement_receiptId_idx" ON "INV_Movement"("receiptId");

-- CreateIndex
CREATE INDEX "INV_Movement_slsPiId_idx" ON "INV_Movement"("slsPiId");

-- CreateIndex
CREATE INDEX "INV_Movement_slsShipmentId_idx" ON "INV_Movement"("slsShipmentId");

-- CreateIndex
CREATE INDEX "INV_Movement_patiscoDocType_patiscoDocId_idx" ON "INV_Movement"("patiscoDocType", "patiscoDocId");

-- CreateIndex
CREATE INDEX "COST_Sheet_productId_idx" ON "COST_Sheet"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "FIN_Payable_receiptId_key" ON "FIN_Payable"("receiptId");

-- CreateIndex
CREATE INDEX "FIN_Payable_supplierId_idx" ON "FIN_Payable"("supplierId");

-- CreateIndex
CREATE INDEX "FIN_Payable_dueDate_idx" ON "FIN_Payable"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FIN_Receivable_shipmentId_key" ON "FIN_Receivable"("shipmentId");

-- CreateIndex
CREATE INDEX "FIN_Receivable_customerId_idx" ON "FIN_Receivable"("customerId");

-- CreateIndex
CREATE INDEX "FIN_Receivable_dueDate_idx" ON "FIN_Receivable"("dueDate");

-- CreateIndex
CREATE INDEX "SLS_FobCostItem_shipmentId_idx" ON "SLS_FobCostItem"("shipmentId");

-- CreateIndex
CREATE INDEX "SLS_FobCostAllocation_costItemId_idx" ON "SLS_FobCostAllocation"("costItemId");

-- CreateIndex
CREATE INDEX "SLS_FobCostAllocation_supplierId_idx" ON "SLS_FobCostAllocation"("supplierId");

-- CreateIndex
CREATE INDEX "UPS_ShipmentLog_trackingNumber_idx" ON "UPS_ShipmentLog"("trackingNumber");

-- CreateIndex
CREATE INDEX "UPS_ShipmentLog_piNo_idx" ON "UPS_ShipmentLog"("piNo");

-- CreateIndex
CREATE INDEX "UPS_ShipmentLog_createdAt_idx" ON "UPS_ShipmentLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MKT_SkuMapping_channelId_platformSku_key" ON "MKT_SkuMapping"("channelId", "platformSku");

-- CreateIndex
CREATE INDEX "MKT_SyncLog_channelId_createdAt_idx" ON "MKT_SyncLog"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "MKT_Order_channelId_status_idx" ON "MKT_Order"("channelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MKT_Order_channelId_platformOrderNo_key" ON "MKT_Order"("channelId", "platformOrderNo");

-- CreateIndex
CREATE UNIQUE INDEX "SLS_DeliveryNote_docNo_key" ON "SLS_DeliveryNote"("docNo");

-- CreateIndex
CREATE INDEX "SLS_DeliveryNote_customerId_idx" ON "SLS_DeliveryNote"("customerId");

-- CreateIndex
CREATE INDEX "SLS_DeliveryNote_slsPiId_idx" ON "SLS_DeliveryNote"("slsPiId");

-- CreateIndex
CREATE INDEX "SLS_DeliveryNote_slsOrderId_idx" ON "SLS_DeliveryNote"("slsOrderId");

-- CreateIndex
CREATE INDEX "SLS_DeliveryNoteItem_deliveryNoteId_idx" ON "SLS_DeliveryNoteItem"("deliveryNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "FIN_PaymentVoucher_voucherNo_key" ON "FIN_PaymentVoucher"("voucherNo");

-- CreateIndex
CREATE INDEX "FIN_PaymentVoucher_supplierId_idx" ON "FIN_PaymentVoucher"("supplierId");

-- CreateIndex
CREATE INDEX "FIN_PaymentVoucher_status_idx" ON "FIN_PaymentVoucher"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FIN_PaymentVoucherItem_payableId_key" ON "FIN_PaymentVoucherItem"("payableId");

-- CreateIndex
CREATE INDEX "FIN_PaymentVoucherItem_voucherId_idx" ON "FIN_PaymentVoucherItem"("voucherId");

-- CreateIndex
CREATE INDEX "FIN_PaymentVoucherAdjustment_voucherId_idx" ON "FIN_PaymentVoucherAdjustment"("voucherId");

-- CreateIndex
CREATE INDEX "PRN_CustomerDefault_customerId_idx" ON "PRN_CustomerDefault"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "PRN_CustomerDefault_customerId_docType_key" ON "PRN_CustomerDefault"("customerId", "docType");

-- CreateIndex
CREATE INDEX "PRN_Template_docType_idx" ON "PRN_Template"("docType");

-- CreateIndex
CREATE INDEX "PRN_ChargeTemplateItem_templateId_idx" ON "PRN_ChargeTemplateItem"("templateId");

-- AddForeignKey
ALTER TABLE "SYS_SettingAuditLog" ADD CONSTRAINT "SYS_SettingAuditLog_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SYS_CompanyAlias" ADD CONSTRAINT "SYS_CompanyAlias_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CUS_Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SYS_CompanyAlias" ADD CONSTRAINT "SYS_CompanyAlias_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SUP_Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SYS_PasswordReset" ADD CONSTRAINT "SYS_PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRD_ProductHistory" ADD CONSTRAINT "PRD_ProductHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRD_ProductHistory" ADD CONSTRAINT "PRD_ProductHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRD_Category" ADD CONSTRAINT "PRD_Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PRD_Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRD_CategoryMapping" ADD CONSTRAINT "PRD_CategoryMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRD_CategoryMapping" ADD CONSTRAINT "PRD_CategoryMapping_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PRD_Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SUP_Supplier" ADD CONSTRAINT "SUP_Supplier_chargeTemplateId_fkey" FOREIGN KEY ("chargeTemplateId") REFERENCES "PRN_ChargeTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SUP_Contact" ADD CONSTRAINT "SUP_Contact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SUP_SupplierProduct" ADD CONSTRAINT "SUP_SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SUP_SupplierProduct" ADD CONSTRAINT "SUP_SupplierProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CUS_CustomerProduct" ADD CONSTRAINT "CUS_CustomerProduct_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CUS_Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CUS_CustomerProduct" ADD CONSTRAINT "CUS_CustomerProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CUS_Customer" ADD CONSTRAINT "CUS_Customer_chargeTemplateId_fkey" FOREIGN KEY ("chargeTemplateId") REFERENCES "PRN_ChargeTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CUS_Contact" ADD CONSTRAINT "CUS_Contact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CUS_Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_Order" ADD CONSTRAINT "PO_Order_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_Order" ADD CONSTRAINT "PO_Order_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SLS_Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_Order" ADD CONSTRAINT "PO_Order_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_Item" ADD CONSTRAINT "PO_Item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PO_Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_Item" ADD CONSTRAINT "PO_Item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_SupplierPI" ADD CONSTRAINT "PO_SupplierPI_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PO_Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_SupplierPI" ADD CONSTRAINT "PO_SupplierPI_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_SupplierPIItem" ADD CONSTRAINT "PO_SupplierPIItem_supplierPIId_fkey" FOREIGN KEY ("supplierPIId") REFERENCES "PO_SupplierPI"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_SupplierPIItem" ADD CONSTRAINT "PO_SupplierPIItem_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "PO_Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_Receipt" ADD CONSTRAINT "PO_Receipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PO_Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_Receipt" ADD CONSTRAINT "PO_Receipt_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_ReceiptItem" ADD CONSTRAINT "PO_ReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PO_Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_ReceiptItem" ADD CONSTRAINT "PO_ReceiptItem_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "PO_Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_Order" ADD CONSTRAINT "SLS_Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CUS_Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_Order" ADD CONSTRAINT "SLS_Order_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_Order" ADD CONSTRAINT "SLS_Order_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_Item" ADD CONSTRAINT "SLS_Item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SLS_Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_Item" ADD CONSTRAINT "SLS_Item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_PI" ADD CONSTRAINT "SLS_PI_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SLS_Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_PI" ADD CONSTRAINT "SLS_PI_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_PIItem" ADD CONSTRAINT "SLS_PIItem_piId_fkey" FOREIGN KEY ("piId") REFERENCES "SLS_PI"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_PIItem" ADD CONSTRAINT "SLS_PIItem_slsItemId_fkey" FOREIGN KEY ("slsItemId") REFERENCES "SLS_Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_Shipment" ADD CONSTRAINT "SLS_Shipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CUS_Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_Shipment" ADD CONSTRAINT "SLS_Shipment_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_ShipmentPI" ADD CONSTRAINT "SLS_ShipmentPI_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "SLS_Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_ShipmentPI" ADD CONSTRAINT "SLS_ShipmentPI_piId_fkey" FOREIGN KEY ("piId") REFERENCES "SLS_PI"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_ShipmentItem" ADD CONSTRAINT "SLS_ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "SLS_Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_ShipmentItem" ADD CONSTRAINT "SLS_ShipmentItem_slsItemId_fkey" FOREIGN KEY ("slsItemId") REFERENCES "SLS_Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_ShipmentItem" ADD CONSTRAINT "SLS_ShipmentItem_piId_fkey" FOREIGN KEY ("piId") REFERENCES "SLS_PI"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "INV_Stock" ADD CONSTRAINT "INV_Stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "INV_Adjustment" ADD CONSTRAINT "INV_Adjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "INV_Adjustment" ADD CONSTRAINT "INV_Adjustment_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "INV_Movement" ADD CONSTRAINT "INV_Movement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "INV_Movement" ADD CONSTRAINT "INV_Movement_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "INV_Movement" ADD CONSTRAINT "INV_Movement_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PO_Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "INV_Movement" ADD CONSTRAINT "INV_Movement_slsPiId_fkey" FOREIGN KEY ("slsPiId") REFERENCES "SLS_PI"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "INV_Movement" ADD CONSTRAINT "INV_Movement_slsShipmentId_fkey" FOREIGN KEY ("slsShipmentId") REFERENCES "SLS_Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "INV_Movement" ADD CONSTRAINT "INV_Movement_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "INV_Adjustment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COST_Sheet" ADD CONSTRAINT "COST_Sheet_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRD_Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COST_Sheet" ADD CONSTRAINT "COST_Sheet_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "SYS_User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIN_Payable" ADD CONSTRAINT "FIN_Payable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIN_Payable" ADD CONSTRAINT "FIN_Payable_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PO_Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIN_Receivable" ADD CONSTRAINT "FIN_Receivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CUS_Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIN_Receivable" ADD CONSTRAINT "FIN_Receivable_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "SLS_Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_FobCostItem" ADD CONSTRAINT "SLS_FobCostItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "SLS_Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_FobCostAllocation" ADD CONSTRAINT "SLS_FobCostAllocation_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "SLS_FobCostItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_FobCostAllocation" ADD CONSTRAINT "SLS_FobCostAllocation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_FobCostAllocation" ADD CONSTRAINT "SLS_FobCostAllocation_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "FIN_Payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MKT_SkuMapping" ADD CONSTRAINT "MKT_SkuMapping_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MKT_Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MKT_SkuMapping" ADD CONSTRAINT "MKT_SkuMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRD_Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MKT_SyncLog" ADD CONSTRAINT "MKT_SyncLog_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MKT_Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MKT_Order" ADD CONSTRAINT "MKT_Order_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MKT_Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MKT_Order" ADD CONSTRAINT "MKT_Order_slsOrderId_fkey" FOREIGN KEY ("slsOrderId") REFERENCES "SLS_Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MKT_OrderItem" ADD CONSTRAINT "MKT_OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MKT_Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_DeliveryNote" ADD CONSTRAINT "SLS_DeliveryNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CUS_Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_DeliveryNote" ADD CONSTRAINT "SLS_DeliveryNote_slsPiId_fkey" FOREIGN KEY ("slsPiId") REFERENCES "SLS_PI"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_DeliveryNote" ADD CONSTRAINT "SLS_DeliveryNote_slsOrderId_fkey" FOREIGN KEY ("slsOrderId") REFERENCES "SLS_Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_DeliveryNote" ADD CONSTRAINT "SLS_DeliveryNote_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "SYS_User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_DeliveryNoteItem" ADD CONSTRAINT "SLS_DeliveryNoteItem_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "SLS_DeliveryNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLS_DeliveryNoteItem" ADD CONSTRAINT "SLS_DeliveryNoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PRD_Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIN_PaymentVoucher" ADD CONSTRAINT "FIN_PaymentVoucher_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SUP_Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIN_PaymentVoucherItem" ADD CONSTRAINT "FIN_PaymentVoucherItem_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "FIN_PaymentVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIN_PaymentVoucherItem" ADD CONSTRAINT "FIN_PaymentVoucherItem_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "FIN_Payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIN_PaymentVoucherAdjustment" ADD CONSTRAINT "FIN_PaymentVoucherAdjustment_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "FIN_PaymentVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRN_CustomerDefault" ADD CONSTRAINT "PRN_CustomerDefault_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CUS_Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRN_ChargeTemplateItem" ADD CONSTRAINT "PRN_ChargeTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PRN_ChargeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

