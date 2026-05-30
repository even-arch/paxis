USE `patiscog4sys`;

DROP TABLE IF EXISTS `patiscog4sys`.`BACKEND_UserLogon`;
CREATE TABLE `patiscog4sys`.`BACKEND_UserLogon` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `LoginID` varchar(50) NOT NULL,
  `Password` varchar(45) NOT NULL,
  `IsEnabled` tinyint(1) DEFAULT 1 COMMENT '0 = 停用, 1 (預設) = 啟用',
  `Language` varchar(6) DEFAULT 'en-US',
  `TimeOffset` tinyint(2) DEFAULT '28',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='後台管理用戶登入認證資料表';

DROP TABLE IF EXISTS `patiscog4sys`.`BS_Company`;
CREATE TABLE  `patiscog4sys`.`BS_Company` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(150) NOT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `Port` varchar(50) DEFAULT NULL,
  `IsSubscribed` tinyint(1) unsigned DEFAULT '0' COMMENT '是否是訂閱租戶, 0 - false, 1 - true',
  `Package` tinyint(1) unsigned DEFAULT '0' COMMENT '0: Trial; 1: Trading; 2: B2B; 3: B2C; 4: API',
  `HasPortrait` tinyint(1) DEFAULT 0 COMMENT '是否有上傳肖像, 0 = false (預設), 1 = true',
  `Status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '0 = 停用, 1 (預設) = 啟用',
  `CreatedDate` datetime NOT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '公司主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`BS_ContactPerson`;
CREATE TABLE  `patiscog4sys`.`BS_ContactPerson` (
  `ID` bigint(20) unsigned NOT NULL,
  `UserID` bigint(20) unsigned NOT NULL COMMENT '對應回公司員工主檔的 ID',
  `Name` varchar(50) DEFAULT NULL,
  `JobID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回職稱的 ID',
  `PhoneNo` varchar(30) DEFAULT NULL,
  `Mobile` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回公司主檔的 ID',
  PRIMARY KEY (`ID`) USING BTREE,
  INDEX `Idx_BS_ContactPerson` (`TenantID`, `UserID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '公司聯絡人';

DROP TABLE IF EXISTS `patiscog4sys`.`BS_CompanyUser`;
CREATE TABLE  `patiscog4sys`.`BS_CompanyUser` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `LoginID` varchar(50) NOT NULL,
  `Password` varchar(45) NOT NULL,
  `PermissionID` bigint(20) unsigned NOT NULL COMMENT '對應回系統會員內部權限的 ID',
  `JobID` bigint(20) unsigned NOT NULL COMMENT '對應回職稱的 ID',
  `DepartmentID` bigint(20) unsigned DEFAULT 0 COMMENT '對應回部門的 ID',
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `Language` varchar(6) DEFAULT 'en-US',
  `TimeOffset` tinyint(2) DEFAULT '28',
  `NumberFormat` tinyint(1) DEFAULT '2',
  `IsEnabled` tinyint(1) DEFAULT 1 COMMENT '0 = 停用, 1 (預設) = 啟用',
  `IsEnabledEMailNotification` tinyint(1) DEFAULT 0 COMMENT '是否啟用郵件通知, 0 (預設) = 停用, 1 = 啟用',
  `HasPortrait` tinyint(1) DEFAULT 0 COMMENT '是否有上傳肖像, 0 = false (預設), 1 = true',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回公司主檔的 ID',
  PRIMARY KEY (`ID`),
  INDEX `Idx_BS_CompanyUser` (`TenantID`, `IsEnabled`, `Name`) USING BTREE,
  INDEX `Idx_BS_CompanyUser2` (`ID`, `TenantID`) USING BTREE,
  INDEX `Idx_BS_CompanyUser_3` (`ID`, `TenantID`, `IsEnabled`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '公司員工主檔，也就是 使用者 主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`BS_Contact`;
CREATE TABLE  `patiscog4sys`.`BS_Contact` (
  `ID` bigint(20) unsigned NOT NULL,
  `InvitationID` bigint(20) unsigned NOT NULL COMMENT '對應回邀請活動主檔的 ID',
  `UserID` bigint(20) unsigned NOT NULL COMMENT '對應回公司員工主檔的 ID',
  `Type` tinyint(1) unsigned DEFAULT '1' COMMENT '1: Buyer; 2: Seller',
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回公司主檔的 ID',
  PRIMARY KEY (`ID`),
  INDEX `Idx_BS_Contact` (`TenantID`, `InvitationID`) USING BTREE,
  INDEX `Idx_BS_Contact2` (`ID`,`TenantID`) USING BTREE,
  INDEX `Idx_BS_Contact_3` (`TenantID`, `InvitationID`, `UserID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '公司員工對應窗口';

DROP TABLE IF EXISTS `patiscog4sys`.`BU_Guest`;
CREATE TABLE  `patiscog4sys`.`BU_Guest` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `Description` varchar(300) DEFAULT NULL COMMENT '文字描述',
  `TradingSetupID` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '對應回交易條件範本主檔的 ID',
  `RequestID` varchar(36) NOT NULL COMMENT '請求 ID',
  `Language` varchar(6) DEFAULT 'en-US',
  `CountryCode` varchar(2) DEFAULT NULL COMMENT '限定單一國家',
  `NumberFormat` tinyint(1) DEFAULT '2',
  `ShopifyID` bigint(20) unsigned DEFAULT '0' COMMENT '對應回 Shopify 商店設定主檔的 ID',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_BU_Guest` (`RequestID`) USING BTREE,
  INDEX `Idx_BU_Guest2` (`TradingSetupID`,`TenantID`) USING BTREE,
  INDEX `Idx_BU_Guest3` (`ID`,`ShopifyID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '公開買家主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`BU_InvitationLog`;
CREATE TABLE  `patiscog4sys`.`BU_InvitationLog` (
  `InvitationID` bigint(20) unsigned NOT NULL COMMENT '對應回邀請活動主檔的 ID',
  `BuyerID` bigint(20) unsigned NOT NULL COMMENT '對應回買家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回公司主檔的 ID',
  PRIMARY KEY (`InvitationID`,`TenantID`) USING BTREE,
  INDEX `Idx_BU_InvitationLog` (`TenantID`,`BuyerID`) USING BTREE,
  INDEX `Idx_BU_InvitationLog2` (`TenantID`,`BuyerID`,`InvitationID`) USING BTREE,
  INDEX `Idx_BU_InvitationLog3` (`BuyerID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '買家被邀請記錄檔';

DROP TABLE IF EXISTS `patiscog4sys`.`BU_ShippingInfo`;
CREATE TABLE  `patiscog4sys`.`BU_ShippingInfo` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `ShipTo` varchar(40) DEFAULT NULL COMMENT '收件公司',
  `Receiver` varchar(50) DEFAULT NULL COMMENT '收件人',
  `ShipVia` varchar(20) DEFAULT NULL,
  `IsDefault` tinyint(1) unsigned DEFAULT NULL COMMENT '是否為預設',
  `BuyerID` bigint(20) unsigned NOT NULL COMMENT '對應回買家主檔的 ID',
  `Destination` varchar(50) DEFAULT NULL COMMENT '目的地 - 港口',
  `PaymentMethod` varchar(50) DEFAULT NULL COMMENT '付款方式 - 由前端輸入',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '買家運送地址範本';

DROP TABLE IF EXISTS `patiscog4sys`.`BU_Buyer`;
CREATE TABLE  `patiscog4sys`.`BU_Buyer` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `ContactPerson` varchar(50) DEFAULT NULL,
  `TradingSetupID` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '對應回交易條件範本主檔的 ID',
  `Note` text DEFAULT NULL,
  `CompanyNumber` varchar(15) DEFAULT NULL,
  `IsDefault` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否為預設買家, 0 - false (預設), 1 - true',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_BU_Buyer` (`TenantID`,`CreatedDate`) USING BTREE,
  INDEX `Idx_BU_Buyer2` (`ID`,`TenantID`) USING BTREE,
  INDEX `Idx_BU_Buyer3` (`TradingSetupID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '買家主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`BU_TradingSetup`;
CREATE TABLE  `patiscog4sys`.`BU_TradingSetup` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `TermAndCondition` text DEFAULT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '交易條件範本主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`BU_Condition`;
CREATE TABLE  `patiscog4sys`.`BU_Condition` (
  `ID` bigint(20) unsigned NOT NULL,
  `EnableViewStock` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `IsNoInventoryBuyable` tinyint(1) unsigned NOT NULL DEFAULT '1',
  `IsCustomizable` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `Payment` tinyint(1) unsigned NOT NULL DEFAULT '2',
  `TradingSetupID` bigint(20) unsigned NOT NULL COMMENT '對應回交易條件範本主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_BU_Condition` (`TradingSetupID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '條件設定';

DROP TABLE IF EXISTS `patiscog4sys`.`BU_QuotationPrinciple`;
CREATE TABLE  `patiscog4sys`.`BU_QuotationPrinciple` (
  `ID` bigint(20) unsigned NOT NULL,
  `RoundedType` tinyint(1) unsigned DEFAULT '1' COMMENT '1: 是否四捨五入; 2: 是否無條件捨去; 3:是否無條件進位',
  `AccurateTo` tinyint(1) unsigned DEFAULT NULL COMMENT '精準度',
  `OperatorOfPriceAdjustmant` tinyint(1) unsigned DEFAULT NULL COMMENT '調整金額之運算子',
  `ValueOfPriceAdjustmant` decimal(11,4) DEFAULT NULL COMMENT '調整金額之值',
  `TypeOfPriceAdjustmant` tinyint(1) unsigned DEFAULT '1' COMMENT '調整金額之種類',
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `TradingSetupID` bigint(20) unsigned NOT NULL COMMENT '對應回交易條件範本主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價原則';

DROP TABLE IF EXISTS `patiscog4sys`.`BU_PriceAdjustmant`;
CREATE TABLE  `patiscog4sys`.`BU_PriceAdjustmant` (
  `ID` bigint(20) unsigned NOT NULL,
  `Type` tinyint(1) unsigned DEFAULT NULL COMMENT '種類',
  `ValueOfCondition` varchar(10) DEFAULT NULL COMMENT '限制條件之值',
  `Operator` tinyint(1) unsigned DEFAULT NULL COMMENT '運算子',
  `Value` decimal(11,4) DEFAULT NULL COMMENT '數值',
  `TypeOfCalculation` tinyint(1) unsigned DEFAULT NULL COMMENT '運算種類',
  `Description` varchar(100) DEFAULT NULL COMMENT '文字描述',
  `TradingSetupID` bigint(20) unsigned NOT NULL COMMENT '對應回交易條件範本主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '總價調整';

DROP TABLE IF EXISTS `patiscog4sys`.`BU_ProductOfPriceImportMask`;
CREATE TABLE  `patiscog4sys`.`BU_ProductOfPriceImportMask` (
  `TradingSetupID` bigint(20) unsigned NOT NULL COMMENT '對應回交易條件範本主檔的 ID',
  `PriceCategoryID` bigint(20) unsigned DEFAULT '0' COMMENT '公司總價格分類中 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_BU_ProductOfPriceImportMask` (`TradingSetupID`,`PriceCategoryID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該買家對應用價格遮罩, 遮掉不顯示資料用';

DROP TABLE IF EXISTS `patiscog4sys`.`CAT_BillboardItem`;
CREATE TABLE  `patiscog4sys`.`CAT_BillboardItem` (
  `ID` bigint(20) unsigned NOT NULL,
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '對應回型錄主檔的 ID',
  `PublicFileID` bigint(20) unsigned NOT NULL COMMENT '對應回公用檔案的 ID',
  `AppendTo` bigint(20) unsigned DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '型錄廣告看板品項檔';

DROP TABLE IF EXISTS `patiscog4sys`.`CAT_Buyer`;
CREATE TABLE  `patiscog4sys`.`CAT_Buyer` (
  `ID` bigint(20) unsigned NOT NULL,
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '對應回型錄主檔的 ID',
  `BuyerID` bigint(20) unsigned NOT NULL COMMENT '對應回買家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_CAT_Buyer` (`CatalogID`,`BuyerID`) USING BTREE,
  INDEX `Idx_CAT_Buyer2` (`BuyerID`,`TenantID`) USING BTREE,
  INDEX `Idx_CAT_Buyer3` (`CatalogID`) USING BTREE,
  INDEX `Idx_CAT_Buyer-4` (`TenantID`,`CatalogID`,`BuyerID`) USING BTREE,
  UNIQUE KEY `Index_UNIQUE_CAT_Buyer` (`CatalogID`,`BuyerID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該型錄所屬的買家';

DROP TABLE IF EXISTS `patiscog4sys`.`CAT_Catalog`;
CREATE TABLE  `patiscog4sys`.`CAT_Catalog` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) DEFAULT NULL,
  `EnableViewPrice` tinyint(1) unsigned NOT NULL DEFAULT '1' COMMENT '是否可檢視價格, 0 - false, 1 - true (預設)',
  `EnableInQuery` tinyint(1) unsigned NOT NULL DEFAULT '0' COMMENT '是否可詢價, 0 - false (預設), 1 - true',
  `IsOnExecCaculateMode` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 (預設) = 非計算價格中, 1 = 在計算價格中',
  `IsDefault` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否為預設型錄, 0 - false (預設), 1 - true',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `LastModifiedDate` datetime NOT NULL,
  `NotifyDateNeedSync` bigint(14) unsigned DEFAULT 0 COMMENT '需要同步的通知日期',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_CAT_Catalog` (`TenantID`,`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '型錄';

DROP TABLE IF EXISTS `patiscog4sys`.`CAT_Category`;
CREATE TABLE  `patiscog4sys`.`CAT_Category` (
  `CategoryID` bigint(20) unsigned NOT NULL COMMENT '對應回產品分類主檔的 ID',
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '對應回型錄主檔的 ID',
  `IsOnTop` tinyint(1) unsigned DEFAULT '1' COMMENT '是否第一頁呈現, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_CAT_Category` (`TenantID`,`CatalogID`,`CategoryID`) USING BTREE,
  INDEX `Idx_CAT_Category2` (`CatalogID`,`CategoryID`) USING BTREE,
  UNIQUE KEY `Index_UNIQUE_CAT_Category` (`TenantID`,`CatalogID`,`CategoryID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該型錄與產品分類主檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`CAT_CategoriesOfProduct`;
CREATE TABLE  `patiscog4sys`.`CAT_CategoriesOfProduct` (
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '對應回型錄主檔的 ID',
  `CategoryID` bigint(20) unsigned NOT NULL COMMENT '對應回產品分類主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回該型錄中所對應的產品的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_CAT_CategoriesOfProduct` (`CatalogID`,`CategoryID`,`ProductID`) USING BTREE,
  INDEX `Idx_CAT_CategoriesOfProduct_2` (`CatalogID`) USING BTREE,
  INDEX `Idx_CAT_CategoriesOfProduct_3` (`ProductID`) USING BTREE,
  INDEX `Idx_CAT_CategoriesOfProduct_4` (`CatalogID`,`ProductID`) USING BTREE,
  INDEX `Idx_CAT_CategoriesOfProduct_5` (`TenantID`, `CatalogID`,`ProductID`) USING BTREE,
  UNIQUE KEY `Index_UNIQUE_CAT_CategoriesOfProduct` (`CatalogID`,`CategoryID`,`ProductID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該型錄中產品與產品分類主檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_CatalogFilterEvent`;
CREATE TABLE  `patiscog4sys`.`SYS_CatalogFilterEvent` (
  `ID` bigint(20) unsigned NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回租戶主檔的 ID',
  `SellerID` bigint(20) unsigned NOT NULL COMMENT '賣家 ID',
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '型錄 ID',
  `BuyerType` ENUM('BUYER', 'GUEST') NOT NULL COMMENT '買家類型',
  `BuyerID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回買家主檔的 ID',
  `GuestID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回公開買家主檔的 ID',
  `ActionType` varchar(30) NOT NULL DEFAULT 'FILTER' COMMENT '行為類型',
  `RawFilter` text DEFAULT NULL COMMENT '原始篩選條件 JSON 字串',
  `CreatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '事件發生時間',
  `EventDate` DATE NOT NULL COMMENT '事件日期',
  PRIMARY KEY (`ID`),
  INDEX `Idx_SYS_CatalogFilterEvent_1` (`TenantID`, `EventDate`) USING BTREE,
  INDEX `Idx_SYS_CatalogFilterEvent_2` (`SellerID`, `EventDate`) USING BTREE,
  INDEX `Idx_SYS_CatalogFilterEvent_3` (`CatalogID`, `EventDate`) USING BTREE,
  INDEX `Idx_SYS_CatalogFilterEvent_4` (`BuyerID`, `EventDate`) USING BTREE,
  INDEX `Idx_SYS_CatalogFilterEvent_5` (`GuestID`, `EventDate`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '型錄篩選行為事件';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_CatalogFilterCategory`;
CREATE TABLE  `patiscog4sys`.`SYS_CatalogFilterCategory` (
  `ID` bigint(20) unsigned NOT NULL,
  `EventID` bigint(20) unsigned NOT NULL COMMENT '對應回篩選事件的 ID',
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回租戶主檔的 ID',
  `CategoryID` bigint(20) unsigned NOT NULL COMMENT '子分類 ID',
  `ParentCategoryID` bigint(20) unsigned DEFAULT NULL COMMENT '父分類 ID',
  `Source` varchar(20) DEFAULT NULL COMMENT '來源: ID 或 Name',
  PRIMARY KEY (`ID`),
  INDEX `Idx_SYS_CatalogFilterCategory_1` (`EventID`) USING BTREE,
  INDEX `Idx_SYS_CatalogFilterCategory_2` (`TenantID`, `CategoryID`) USING BTREE,
  INDEX `Idx_SYS_CatalogFilterCategory_3` (`TenantID`, `ParentCategoryID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '型錄篩選分類明細';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_CatalogFilterPriceRange`;
CREATE TABLE  `patiscog4sys`.`SYS_CatalogFilterPriceRange` (
  `ID` bigint(20) unsigned NOT NULL,
  `EventID` bigint(20) unsigned NOT NULL COMMENT '對應回篩選事件的 ID',
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回租戶主檔的 ID',
  `Min` decimal(11,4) DEFAULT NULL COMMENT '最低價格',
  `Max` decimal(11,4) DEFAULT NULL COMMENT '最高價格',
  `Currency` char(3) DEFAULT NULL COMMENT '貨幣代碼',
  PRIMARY KEY (`ID`),
  INDEX `Idx_SYS_CatalogFilterPriceRange_1` (`EventID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '型錄篩選價格區間';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_CatalogFilterText`;
CREATE TABLE  `patiscog4sys`.`SYS_CatalogFilterText` (
  `ID` bigint(20) unsigned NOT NULL,
  `EventID` bigint(20) unsigned NOT NULL COMMENT '對應回篩選事件的 ID',
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回租戶主檔的 ID',
  `Field` ENUM('SKU','Name','ModelNo','Note','Specification') NOT NULL COMMENT '篩選欄位',
  `Value` varchar(200) NOT NULL COMMENT '篩選值',
  `IsFuzzy` tinyint(1) unsigned NOT NULL DEFAULT '1' COMMENT '是否模糊查詢 0-否 1-是',
  PRIMARY KEY (`ID`),
  INDEX `Idx_SYS_CatalogFilterText_1` (`EventID`) USING BTREE,
  INDEX `Idx_SYS_CatalogFilterText_2` (`TenantID`, `Field`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '型錄篩選文字條件';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_CatalogFilterProduct`;
CREATE TABLE  `patiscog4sys`.`SYS_CatalogFilterProduct` (
  `ID` bigint(20) unsigned NOT NULL,
  `EventID` bigint(20) unsigned NOT NULL COMMENT '對應回篩選事件的 ID',
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回租戶主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '產品 ID',
  `ProductName` varchar(200) DEFAULT NULL COMMENT '產品名稱',
  `SKU` varchar(100) DEFAULT NULL COMMENT '產品 SKU',
  `ModelNo` varchar(100) DEFAULT NULL COMMENT '產品型號',
  `CreatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
  `Unit` varchar(50) DEFAULT NULL COMMENT '產品 Unit',
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL COMMENT '產品 貨幣代碼',
  `TradingCode` tinyint(3) unsigned DEFAULT NULL COMMENT '交易代碼',
  `MOQ` int(10) unsigned DEFAULT NULL COMMENT 'Minimum Order Quantity',
  `Price` decimal(11,4) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_SYS_CatalogFilterProduct_1` (`EventID`) USING BTREE,
  INDEX `Idx_SYS_CatalogFilterProduct_2` (`TenantID`, `ProductID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '型錄篩選產品明細';

DROP TABLE IF EXISTS `patiscog4sys`.`CAT_Guest`;
CREATE TABLE  `patiscog4sys`.`CAT_Guest` (
  `ID` bigint(20) unsigned NOT NULL,
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '對應回型錄主檔的 ID',
  `GuestID` bigint(20) unsigned NOT NULL COMMENT '對應回公開買家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_CAT_Guest` (`CatalogID`,`GuestID`) USING BTREE,
  INDEX `Idx_CAT_Guest2` (`GuestID`,`TenantID`) USING BTREE,
  INDEX `Idx_CAT_Guest3` (`GuestID`) USING BTREE,
  UNIQUE KEY `Index_UNIQUE_CAT_Guest` (`CatalogID`,`GuestID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該型錄所屬的公開買家';

DROP TABLE IF EXISTS `patiscog4sys`.`CAT_Product`;
CREATE TABLE  `patiscog4sys`.`CAT_Product` (
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '對應回型錄主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回產品主檔的 ID',
  `Name` varchar(100) DEFAULT NULL COMMENT '產品主檔的 Name, 供查詢用',
  `SKU` varchar(100) DEFAULT NULL COMMENT '產品主檔的 SKU, 供查詢用',
  `ModelNo` varchar(100) DEFAULT NULL COMMENT '產品主檔的 ModelNo, 供查詢用',
  `Unit` varchar(50) DEFAULT NULL COMMENT '產品主檔的 Unit, 供查詢用',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_CAT_Product` (`CatalogID`,`ProductID`) USING BTREE,
  INDEX `Idx_CAT_Product_2` (`ProductID`,`CatalogID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該型錄中所對應的產品';

DROP TABLE IF EXISTS `patiscog4sys`.`CAT_ProductOfPrice`;
CREATE TABLE  `patiscog4sys`.`CAT_ProductOfPrice` (
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '對應回型錄主檔的 ID',
  `TradingSetupID` bigint(20) unsigned NOT NULL COMMENT '對應回交易條件範本主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回產品主檔的 ID',
  `MOQ` int(10) unsigned NOT NULL COMMENT 'Minimum Order Quantity',
  `Price` decimal(11,4) NOT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `MSRP` decimal(11,4) DEFAULT NULL COMMENT 'Manufacturer Suggested Retail Price',
  `PriceCategoryID` bigint(20) unsigned DEFAULT '0' COMMENT '公司總價格分類中 ID, 供更新同步用',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`CatalogID`,`TradingSetupID`,`ProductID`,`MOQ`),
  INDEX `Idx_CAT_ProductOfPrice` (`ProductID`,`TradingSetupID`) USING BTREE,
  INDEX `Idx_CAT_ProductOfPrice2` (`CatalogID`,`ProductID`,`TradingSetupID`) USING BTREE,
  INDEX `Idx_CAT_ProductOfPrice_product_price_lookup` (`TenantID`,`ProductID`,`TradingSetupID`,`MOQ`) USING BTREE,
  INDEX `Idx_CAT_ProductOfPrice_product_price_lookup_2` (`TenantID`,`CatalogID`,`ProductID`,`TradingSetupID`) USING BTREE,
  INDEX `Idx_CAT_ProductOfPrice_product_price_lookup_3` (`TenantID`,`CatalogID`,`ProductID`,`TradingSetupID`, `MOQ` desc) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該型錄所屬的買家對應的價格';

DROP TABLE IF EXISTS `patiscog4sys`.`CAT_ProductOfPriceMask`;
CREATE TABLE  `patiscog4sys`.`CAT_ProductOfPriceMask` (
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '對應回型錄主檔的 ID',
  `TradingSetupID` bigint(20) unsigned NOT NULL COMMENT '對應回交易條件範本主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回產品主檔的 ID',
  `IsExpired` tinyint(1) DEFAULT 1 COMMENT '1 (預設) = 已過期',
  `Type` tinyint(1) unsigned NOT NULL COMMENT '異動種類, 1- Update, 2 - Delete',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_CAT_ProductOfPriceMask` (`CatalogID`,`TradingSetupID`,`ProductID`) USING BTREE,
  INDEX `Idx_CAT_ProductOfPriceMask2` (`CatalogID`,`TradingSetupID`,`ProductID`,`IsExpired`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該型錄所屬的買家對應的價格遮罩';

DROP TABLE IF EXISTS `patiscog4sys`.`CAT_ShoppingCart`;
CREATE TABLE  `patiscog4sys`.`CAT_ShoppingCart` (
  `ID` bigint(20) unsigned NOT NULL,
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '賣家提供的型錄主檔 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '賣家提供的產品主檔 ID',
  `BuyerID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回買家主檔的 ID',
  `GuestID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回公開買家主檔的 ID',
  `ShadowID` bigint(20) unsigned DEFAULT NULL COMMENT '每次公開買家使用的 ID',
  `Quantity` int(10) unsigned NOT NULL DEFAULT 0,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_CAT_ShoppingCart` (`BuyerID`,`CatalogID`,`ProductID`) USING BTREE,
  INDEX `Idx_CAT_ShoppingCart_2` (`ShadowID`,`CatalogID`,`ProductID`) USING BTREE,
  INDEX `Idx_CAT_ShoppingCart_3` (`CatalogID`) USING BTREE,
  INDEX `Idx_CAT_ShoppingCart_filter` (`BuyerID`,`TenantID`,`CatalogID`,`ProductID`) USING BTREE,
  INDEX `Idx_CAT_ShoppingCart_buyer` (`BuyerID`,`TenantID`,`CatalogID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '買家 / 公開買家於賣家某個目錄的購物車';

DROP TABLE IF EXISTS `patiscog4sys`.`CAT_TimeStampOfPublishToShopify`;
CREATE TABLE  `patiscog4sys`.`CAT_TimeStampOfPublishToShopify` (
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '對應回型錄主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回該型錄中所對應的產品的 ID',
  `ShopifyID` bigint(20) unsigned NOT NULL COMMENT '對應回 Shopify 商店設定主檔的 ID',
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`CatalogID`,`ProductID`,`ShopifyID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該型錄所屬的商品上架到 Shopify 的紀錄';

DROP TABLE IF EXISTS `patiscog4sys`.`DIS_Actives`;
CREATE TABLE  `patiscog4sys`.`DIS_Actives` (
  `ID` bigint(20) unsigned NOT NULL,
  `TopicID` bigint(20) unsigned NOT NULL COMMENT '對應回溝通主檔的 ID',
  `Type` tinyint(1) unsigned NOT NULL COMMENT '種類 - 1 = Text, 2 = Report - Order, 3 = Report - Quotation, 4 = Attachment - Discuss / Public, 11 = Add Joiner, 12 = Remove Joiner, 21 = RefItem - Order, 22 = RefItem - Quotation, 23 = RefItem - Product, 24 = RefItem - Category, 25 = RefItem - Order of copy, 26 = RefItem - Quotation of copy, 27 = RefItem - Category of seller',
  `Context` text NOT NULL,
  `ReportID` bigint(20) unsigned DEFAULT 0 COMMENT '報表 - 報表唯一 ID',
  `RefItemSourceID` bigint(20) unsigned DEFAULT 0 COMMENT '參考對象 - 來源唯一 ID',
  `RefItemProductID` bigint(20) unsigned DEFAULT 0 COMMENT '參考對象 - 來源商品唯一 ID',
  `RefItemSellerID` bigint(20) unsigned DEFAULT 0 COMMENT '參考對象 - 來源賣家唯一 ID, 對應回賣家主檔的 ID',
  `AttachmentID` bigint(20) unsigned DEFAULT 0 COMMENT '附加檔 - 附加檔唯一 ID',
  `JoinerID` bigint(20) unsigned DEFAULT 0 COMMENT '對應回溝通參與者的 ID',
  `JoinerName` varchar(50) DEFAULT '' COMMENT '參與者名稱',
  `ReplyOn` bigint(20) unsigned DEFAULT '0',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`),
  INDEX `Idx_DIS_Actives` (`TopicID`,`TenantID`,`RefItemSourceID`) USING BTREE,
  INDEX `Idx_DIS_Actives_2` (`TopicID`,`TenantID`,`Type`,`CreatedDate` DESC) USING BTREE,
  INDEX `Idx_DIS_Actives_3` (`TopicID`,`TenantID`,`Type`,`CreatedDate`,`ID`) USING BTREE,
  INDEX `Idx_DIS_Actives_4` (`TenantID`,`TopicID`,`Type`) USING BTREE,
  INDEX `Idx_DIS_Actives_5` (`TenantID`,`TopicID`,`CreatedDate` DESC) USING BTREE,
  INDEX `Idx_DIS_Actives_6` (`TenantID`,`TopicID`,`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '溝通活動內容';

DROP TABLE IF EXISTS `patiscog4sys`.`DIS_Attachment`;
CREATE TABLE  `patiscog4sys`.`DIS_Attachment` (
  `ID` bigint(20) unsigned NOT NULL,
  `TopicID` bigint(20) unsigned NOT NULL COMMENT '對應回溝通主檔的 ID',
  `ActiveID` bigint(20) unsigned NOT NULL COMMENT '對應回溝通活動內容的 ID',
  `Name` varchar(50) NOT NULL,
  `Extension` varchar(7) NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`),
  UNIQUE KEY `Index_UNIQUE_DIS_Attachment` (`TenantID`,`TopicID`,`ActiveID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '溝通活動附加檔';

DROP TABLE IF EXISTS `patiscog4sys`.`DIS_Receive_Actives`;
CREATE TABLE  `patiscog4sys`.`DIS_Receive_Actives` (
  `ID` bigint(20) unsigned NOT NULL,
  `TopicID` bigint(20) unsigned NOT NULL COMMENT '對應回溝通主檔的 ID',
  `Type` tinyint(1) unsigned NOT NULL COMMENT '種類 - 1 = Text, 2 = Report - Order, 3 = Report - Quotation, 4 = Attachment - Discuss, 11 = Add Joiner, 12 = Remove Joiner, 21 = RefItem - Order, 22 = RefItem - Quotation, 23 = RefItem - Product, 24 = RefItem - Category, 25 = RefItem - Order of copy, 26 = RefItem - Quotation of copy, 27 = RefItem - Category of seller',
  `Context` text NOT NULL,
  `ReportID` bigint(20) unsigned DEFAULT 0 COMMENT '報表 - 報表唯一 ID',
  `RefItemSourceID` bigint(20) unsigned DEFAULT 0 COMMENT '參考對象 - 來源唯一 ID',
  `RefItemProductID` bigint(20) unsigned DEFAULT 0 COMMENT '參考對象 - 來源商品唯一 ID',
  `AttachmentID` bigint(20) unsigned DEFAULT 0 COMMENT '附加檔 - 附加檔唯一 ID',
  `JoinerID` bigint(20) unsigned DEFAULT 0 COMMENT '對應回溝通參與者的 ID',
  `JoinerName` varchar(50) DEFAULT '' COMMENT '參與者名稱',
  `OtherSiteCreatedBy` varchar(50) DEFAULT '',
  `ReplyOn` bigint(20) unsigned DEFAULT '0',
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`),
  INDEX `Idx_DIS_Receive_Actives` (`TopicID`,`TenantID`,`RefItemSourceID`) USING BTREE,
  INDEX `Idx_DIS_Receive_Actives_2` (`TopicID`,`TenantID`,`CreatedDate` DESC) USING BTREE,
  INDEX `Idx_DIS_Receive_Actives_3` (`TopicID`,`TenantID`,`CreatedDate`) USING BTREE,
  INDEX `Idx_DIS_Receive_Actives_4` (`TenantID`,`TopicID`,`Type`) USING BTREE,
  INDEX `Idx_DIS_Receive_Actives_5` (`TenantID`,`TopicID`,`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '溝通活動內容 - 接收方';

DROP TABLE IF EXISTS `patiscog4sys`.`DIS_Joiners`;
CREATE TABLE  `patiscog4sys`.`DIS_Joiners` (
  `ID` bigint(20) unsigned NOT NULL,
  `TopicID` bigint(20) unsigned NOT NULL COMMENT '對應回溝通主檔的 ID',
  `Type` tinyint(1) unsigned NOT NULL COMMENT '種類 - 1 = Inside, 2 = Buyer, 3 = Seller, 4 = Others',
  `SourceID` bigint(20) unsigned NOT NULL COMMENT '來源唯一的 ID',
  `SourceTenantID` bigint(20) unsigned DEFAULT '0' COMMENT '對應回公司主檔的 ID',
  `SourceContactID` bigint(20) unsigned DEFAULT '0' COMMENT '來源的對應窗口 ID',
  `SourceContactName` varchar(50) DEFAULT '' COMMENT '來源的對應窗口名稱',
  `IsCreatedByOthers` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為其他人建立, 0 - false, 1 - true',
  `IsCreator` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為此溝通建立者, 0 - false, 1 - true',
  `HasLeft` tinyint(1) unsigned DEFAULT '0' COMMENT '是否離開討論, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`),
  INDEX `Idx_DIS_Joiners` (`TenantID`,`TopicID`,`Type`) USING BTREE,
  INDEX `Idx_DIS_Joiners_2` (`TopicID`,`TenantID`) USING BTREE,
  INDEX `Idx_DIS_Joiners_3` (`TenantID`,`TopicID`,`SourceID`) USING BTREE,
  INDEX `Idx_DIS_Joiners_4` (`TopicID`,`TenantID`,`HasLeft`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '溝通參與者';

DROP TABLE IF EXISTS `patiscog4sys`.`DIS_Read_States`;
CREATE TABLE `patiscog4sys`.`DIS_Read_States` (
  `ID` bigint(20) unsigned NOT NULL,
  `TopicID` bigint(20) unsigned NOT NULL COMMENT '對應溝通主檔 (DIS_Topic.ID)',
  `ActiveID` bigint(20) unsigned NOT NULL COMMENT '對應訊息 (DIS_Actives.ID)',
  `SenderTenantID` bigint(20) unsigned NOT NULL COMMENT '傳送方租戶',
  `ReaderTenantID` bigint(20) unsigned NOT NULL COMMENT '接收方租戶',
  `ReaderJoinerID` bigint(20) unsigned NOT NULL COMMENT '接收方參與者 (DIS_Joiners.ID)',
  `IsRead` tinyint(1) unsigned NOT NULL DEFAULT 0 COMMENT '同步後的已讀旗標',
  `ReadOn` datetime NULL DEFAULT NULL COMMENT '接收方讀取時間（由接收方回報）',
  `NotifiedOn` datetime NULL DEFAULT NULL COMMENT '傳送方已通知 UI 的時間',
  `LastSyncOn` datetime NULL DEFAULT NULL COMMENT '同步紀錄更新時間',
  PRIMARY KEY (`ID`,`SenderTenantID`),
  INDEX `Idx_DIS_ReadStates_Active` (`SenderTenantID`,`ActiveID`,`IsRead`,`ReadOn`),
  INDEX `Idx_DIS_ReadStates_Topic` (`SenderTenantID`,`TopicID`,`IsRead`),
  INDEX `Idx_DIS_ReadStates_Reader` (`ReaderTenantID`,`ReaderJoinerID`,`ActiveID`),
  INDEX `Idx_DIS_ReadStates_Reader_2` (`SenderTenantID`,`TopicID`,`ActiveID`,`ReaderJoinerID`,`IsRead`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '傳送方掌握的訊息已讀狀態';

DROP TABLE IF EXISTS `patiscog4sys`.`DIS_Topic`;
CREATE TABLE  `patiscog4sys`.`DIS_Topic` (
  `ID` bigint(20) unsigned NOT NULL,
  `Title` varchar(150) NOT NULL,
  `IsSentByOthers` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為對方發出, 0 - false, 1 - true',
  `OtherSiteCreatedBy` varchar(50) DEFAULT '',
  `ForwardFrom` bigint(20) unsigned DEFAULT '0',
  `CreatedBy` bigint(20) unsigned DEFAULT '0',
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`),
  INDEX `Idx_DIS_Topic` (`TenantID`,`Title`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '溝通主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`DIS_UnRead`;
CREATE TABLE  `patiscog4sys`.`DIS_UnRead` (
  `ID` bigint(20) unsigned NOT NULL,
  `TopicID` bigint(20) unsigned NOT NULL COMMENT '對應回溝通主檔的 ID',
  `ActiveID` bigint(20) unsigned NOT NULL COMMENT '對應回溝通活動內容檔的 ID',
  `IsRead` tinyint(1) unsigned NOT NULL DEFAULT 0 COMMENT '0 = 未讀, 1 = 已讀, 由接收方維護',
  `ReadOn` datetime NULL DEFAULT NULL COMMENT '接收方確認讀取時間',
  `ReaderTenantID` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT '接收方租戶（支援跨租戶抄寫）',
  `ReaderJoinerID` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT '接收方對應的 DIS_Joiners.ID',
  `SyncToken` char(36) DEFAULT NULL COMMENT '跨租戶同步用的對應識別',
  `JoinerID` bigint(20) unsigned NOT NULL COMMENT '對應回溝通參與者檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_DIS_UnRead` (`JoinerID`,`TenantID`,`TopicID`) USING BTREE,
  INDEX `Idx_DIS_UnRead_2` (`TenantID`,`TopicID`,`ActiveID`,`JoinerID`) USING BTREE,
  INDEX `Idx_DIS_UnRead_Joiner_Unread` (`TenantID`,`JoinerID`,`IsRead`,`ActiveID`) USING BTREE,
  INDEX `Idx_DIS_UnRead_Active_ReadOn` (`TenantID`,`ActiveID`,`IsRead`,`ReadOn`) USING BTREE,
  INDEX `Idx_DIS_UnRead_Sync` (`ReaderTenantID`,`ReaderJoinerID`,`ActiveID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '溝通訊息的未讀訊息列表(接收方)';

DROP TABLE IF EXISTS `patiscog4sys`.`EXT_Language`;
CREATE TABLE  `patiscog4sys`.`EXT_Language` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(6) NOT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '系統多語系設定主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`EXT_Program`;
CREATE TABLE  `patiscog4sys`.`EXT_Program` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(150) NOT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '系統程序主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`EXT_Program_Permission_Mapping`;
CREATE TABLE  `patiscog4sys`.`EXT_Program_Permission_Mapping` (
  `ProgramID` bigint(20) unsigned NOT NULL COMMENT '對應回系統程序主檔的 ID',
  `PermissionID` bigint(20) unsigned NOT NULL COMMENT '對應回系統權限的 ID',
  `IsEnabled` tinyint(1) DEFAULT 1 COMMENT '0 = 停用, 1 (預設) = 啟用',
  `IsReadOnly` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為唯讀, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_EXT_Program_Permission_Mapping` (`PermissionID`,`ProgramID`) USING BTREE,
  INDEX `Idx_EXT_Program_Permission_Mapping_2` (`PermissionID`,`ProgramID`,`IsEnabled`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '系統會員內部權限與系統程序的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`EXT_Permission`;
CREATE TABLE  `patiscog4sys`.`EXT_Permission` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(150) NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  UNIQUE KEY `Index_UNIQUE_EXT_Permission` (`ID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '系統會員內部權限';

DROP TABLE IF EXISTS `patiscog4sys`.`INV_BeInvitedLog`;
CREATE TABLE  `patiscog4sys`.`INV_BeInvitedLog` (
  `ID` bigint(20) unsigned NOT NULL,
  `IsAccepted` tinyint(1) unsigned DEFAULT '0' COMMENT '是否接受, 0 - false, 1 - true, 2 - terminate(終止)',
  `Language` varchar(6) DEFAULT 'en-US',
  `Type` tinyint(1) unsigned NOT NULL COMMENT '公司種類, 1- 買家, 2 - 賣家',
  `CreatedDate` datetime NOT NULL,
  `RequestID` varchar(36) NOT NULL COMMENT '請求 ID',
  `ModifiedBy` bigint(20) unsigned DEFAULT NULL COMMENT '編輯者, 對應回公司員工主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回公司主檔的 ID',
  PRIMARY KEY (`ID`) USING BTREE,
  INDEX `Idx_INV_BeInvitedLog` (`ID`,`TenantID`,`IsAccepted`) USING BTREE,
  INDEX `Idx_INV_BeInvitedLog2` (`ID`,`TenantID`) USING BTREE,
  INDEX `Idx_INV_BeInvitedLog3` (`ID`,`IsAccepted`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '被邀請紀錄';

DROP TABLE IF EXISTS `patiscog4sys`.`INV_BlackList`;
CREATE TABLE  `patiscog4sys`.`INV_BlackList` (
  `EMail` varchar(50) NOT NULL,
  PRIMARY KEY (`EMail`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '邀請 - 黑清單';

DROP TABLE IF EXISTS `patiscog4sys`.`INV_InvitationActivity`;
CREATE TABLE  `patiscog4sys`.`INV_InvitationActivity` (
  `ID` bigint(20) unsigned NOT NULL,
  `IsAccepted` tinyint(1) unsigned DEFAULT '0' COMMENT '是否接受, 0 - false, 1 - true, 2 - cancel(終止)',
  `IsFromGuestCatalog` tinyint(1) unsigned DEFAULT '0' COMMENT '邀請是否從公開目錄來, 0 - false, 1 - true',
  `Language` varchar(6) DEFAULT 'en-US',
  `Type` tinyint(1) unsigned NOT NULL COMMENT '公司種類, 1- 買家, 2 - 賣家',
  `SourceID` bigint(20) unsigned DEFAULT 0 COMMENT '對應回買家/賣家主檔用ID，提供給重複發送邀請信時使用，需搭配Type一同使用',
  `Title` varchar(50) NOT NULL,
  `EMail` varchar(50) NOT NULL,
  `RequestID` varchar(36) NOT NULL COMMENT '請求 ID',
  `ModifiedBy` bigint(20) unsigned NOT NULL COMMENT '編輯者, 對應回公司員工主檔的 ID',
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回公司主檔的 ID',
  PRIMARY KEY (`ID`) USING BTREE,
  INDEX `Idx_INV_InvitationActivity` (`ID`,`TenantID`,`IsAccepted`) USING BTREE,
  INDEX `Idx_INV_InvitationActivity2` (`ID`,`TenantID`) USING BTREE,
  INDEX `Idx_INV_InvitationActivity3` (`ID`,`IsAccepted`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '邀請活動';

DROP TABLE IF EXISTS `patiscog4sys`.`INV_TMP_CompanyInfo`;
CREATE TABLE  `patiscog4sys`.`INV_TMP_CompanyInfo` (
  `InvitationID` bigint(20) unsigned NOT NULL COMMENT '對應回邀請活動主檔的 ID',
  `Address` varchar(200) DEFAULT '',
  `City` varchar(40) DEFAULT '',
  `CountryCode` varchar(2) DEFAULT '',
  `PostalCode` varchar(10) DEFAULT '',
  `PhoneNo` varchar(30) DEFAULT '',
  `FAX` varchar(30) DEFAULT '',
  `TaxID` varchar(15) DEFAULT '',
  `ContactName` varchar(50) DEFAULT '',
  `ContactPhoneNo` varchar(30) DEFAULT '',
  `ContactMobile` varchar(30) DEFAULT '',
  `ContactEMail` varchar(50) DEFAULT '',
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回公司主檔的 ID',
  PRIMARY KEY (`InvitationID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '邀請活動中對方的資料,一次性使用';

DROP TABLE IF EXISTS `patiscog4sys`.`INV_WhiteList`;
CREATE TABLE  `patiscog4sys`.`INV_WhiteList` (
  `EMail` varchar(50) NOT NULL,
  PRIMARY KEY (`EMail`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '邀請 - 白清單';

DROP TABLE IF EXISTS `patiscog4sys`.`NT_Notification`;
CREATE TABLE  `patiscog4sys`.`NT_Notification` (
  `ID` bigint(20) unsigned NOT NULL,
  `Type` tinyint(1) unsigned NOT NULL,
  `UserID` bigint(20) unsigned NOT NULL COMMENT '對應回公司員工主檔的 ID',
  `Content` text NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_NT_Notification` (`TenantID`,`UserID`,`Type`,`CreatedDate`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '推播通知主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Buyer`;
CREATE TABLE  `patiscog4sys`.`ORD_Buyer` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `Name` varchar(150) DEFAULT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Index_UNIQUE_ORD_Buyer` (`OrderID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '買家資訊';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Buyer_Mapping`;
CREATE TABLE  `patiscog4sys`.`ORD_Buyer_Mapping` (
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `BuyerID` bigint(20) unsigned NOT NULL COMMENT '對應回買家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  UNIQUE KEY `Index_UNIQUE_ORD_Buyer_Mapping` (`OrderID`,`BuyerID`),
  INDEX `Idx_ORD_Buyer_Mapping` (`TenantID`,`OrderID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單與買家主檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_Buyer`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_Buyer` (
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔影本的 ID',
  `Name` varchar(150) DEFAULT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`OrderID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本買家資訊';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_Buyer_Mapping`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_Buyer_Mapping` (
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔影本的 ID',
  `BuyerID` bigint(20) unsigned NOT NULL COMMENT '對應回賣家中買家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  UNIQUE KEY `Index_UNIQUE_ORD_Copy_Buyer_Mapping` (`OrderID`,`BuyerID`),
  INDEX `Idx_ORD_Copy_Buyer_Mapping` (`OrderID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本與買家主檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_ExtraCharge`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_ExtraCharge` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔影本的 ID',
  `Name` varchar(50) NOT NULL,
  `Type` tinyint(3) unsigned NOT NULL,
  `Amount` decimal(11,4) NOT NULL,
  `IsPriceAdjustmant` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為總價調整, 0 - false, 1 - true',
  `IsBeSeen` tinyint(1) DEFAULT 1 COMMENT '是否要輸出到報表中, 0 - false, 1 - true',
  `ProductPriceAdjustmantID` bigint(20) unsigned DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`,`OrderID`),
  INDEX `Idx_ORD_Copy_ExtraCharge` (`OrderID`,`TenantID`,`IsBeSeen`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本另增收費';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_Log`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_Log` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔影本的 ID',
  `Type` tinyint(1) unsigned NOT NULL,
  `Context` text DEFAULT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `OtherSiteCreatedBy` varchar(50) DEFAULT '',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_ORD_Copy_Log` (`TenantID`,`OrderID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本日誌';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_Order`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_Order` (
  `ID` bigint(20) unsigned NOT NULL,
  `No` varchar(40) DEFAULT NULL,
  `ExpiredDate` date DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `Port` varchar(50) DEFAULT NULL,
  `TermAndCondition` text DEFAULT NULL,
  `Status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 = 編輯中, 1 = 已確認, 2 = 已封存',
  `IsNeedSync` tinyint(1) unsigned DEFAULT '0' COMMENT '是否有同步資料, 0 - false, 1 - true',
  `IsSeenByOtherSite` tinyint(1) unsigned DEFAULT '0' COMMENT '對方是否已同步資料, 0 - false, 1 - true',
  `IsPaid` tinyint(1) unsigned DEFAULT '0' COMMENT '是否已付費, 0 - false, 1 - true',
  `IsEnablePay` tinyint(1) unsigned DEFAULT '0' COMMENT '是否可付費，僅正本可編輯, 0 - false, 1 - true',
  `StatusOfOtherSite` tinyint(1) NOT NULL DEFAULT 0 COMMENT '對方(正/副本)狀態, 0 (預設) = 編輯中, 1 - 已確認, 2 = 已封存, 4 = 已取消',
  `Payment` tinyint(1) unsigned DEFAULT '2' COMMENT '付費方式, 2 - Non payment',
  `Price` decimal(11,4) DEFAULT NULL,
  `Type` tinyint(1) unsigned DEFAULT 1 COMMENT '種類 - 1 = PO, 2 = PI',
  `DiscussLink` bigint(20) unsigned DEFAULT '0',
  `RootLink` bigint(20) unsigned DEFAULT '0',
  `SnapshotID` bigint(20) unsigned DEFAULT '0' COMMENT '雙方同步用快照唯一 ID',
  `ModifiedBy` bigint(20) unsigned DEFAULT '0',
  `LastModifiedDate` datetime DEFAULT NULL,
  `CreatedDate` datetime NOT NULL,
  `OriTenantID` bigint(20) unsigned NOT NULL COMMENT '原資料來源的 Tenant ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`, `TenantID`),
  INDEX `Idx_ORD_Copy_Order` (`TenantID`,`Status`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_PriceAdjustmant`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_PriceAdjustmant` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `Type` tinyint(1) unsigned DEFAULT NULL COMMENT '種類',
  `ValueOfCondition` varchar(10) DEFAULT NULL COMMENT '限制條件之值',
  `Operator` tinyint(1) unsigned DEFAULT NULL COMMENT '運算子',
  `Value` decimal(11,4) DEFAULT NULL COMMENT '數值',
  `TypeOfCalculation` tinyint(1) unsigned DEFAULT NULL COMMENT '運算種類',
  `Description` varchar(100) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本(PI)總價調整';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_Product`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_Product` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔影本的 ID',
  `Name` varchar(100) DEFAULT NULL,
  `SKU` varchar(100) DEFAULT NULL COMMENT 'Stock Keeping Unit No',
  `ModelNo` varchar(100) DEFAULT NULL,
  `Specification` text DEFAULT NULL,
  `Note` text DEFAULT NULL,
  `SizeUnit` tinyint(3) unsigned DEFAULT NULL,
  `Length` double(8,4) unsigned DEFAULT NULL,
  `Height` double(8,4) unsigned DEFAULT NULL,
  `Width` double(8,4) unsigned DEFAULT NULL,
  `WeightUnit` tinyint(3) unsigned DEFAULT NULL,
  `NetWeight` double(8,4) unsigned DEFAULT NULL,
  `TotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積',
  `ImperialTotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 英制',
  `GrossWeight` double(8,4) unsigned DEFAULT NULL,
  `UnitPerCarton` int(10) unsigned DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `Unit` varchar(50) DEFAULT NULL,
  `MOQ` int(10) unsigned DEFAULT NULL COMMENT 'Minimum Order Quantity',
  `Price` decimal(11,4) DEFAULT NULL,
  `Quantity` int(10) unsigned DEFAULT NULL,
  `TraceabilityID` bigint(20) unsigned DEFAULT '0' COMMENT '對應回供應方產品主檔的 ID',
  `Notes` text DEFAULT NULL COMMENT 'Records important remarks or considerations for both buyer and seller during the transaction',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`,`OrderID`),
  INDEX `Idx_ORD_Copy_Product` (`OrderID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本產品主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_Product_PriceAdjustmant`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_Product_PriceAdjustmant` (
  `ID` bigint(20) unsigned NOT NULL,
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品主檔的 ID',
  `Type` tinyint(1) unsigned DEFAULT 3 COMMENT '種類 - 3 = 單一產品總金額 $',
  `ValueOfCondition` varchar(10) DEFAULT NULL COMMENT '限制條件之值',
  `Operator` tinyint(1) unsigned DEFAULT NULL COMMENT '運算子',
  `Value` decimal(11,4) DEFAULT NULL COMMENT '數值',
  `TypeOfCalculation` tinyint(1) unsigned DEFAULT NULL COMMENT '運算種類',
  `Description` varchar(100) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本品項的價格調整';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_Product_Traceability`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_Product_Traceability` (
  `ID` bigint(20) unsigned NOT NULL,
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單影本產品主檔的 ID',
  `Source` tinyint(1) unsigned NOT NULL COMMENT '來源代號',
  `SourceProductID` bigint(20) unsigned NOT NULL COMMENT '來源產品唯一的 ID',
  `SourceID` bigint(20) unsigned DEFAULT 0 COMMENT '來源唯一的 ID',
  `SellerID` bigint(20) unsigned DEFAULT 0 COMMENT '對應回賣家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_ORD_Copy_Product_Traceability` (`ProductID`) USING BTREE,
  INDEX `Idx_ORD_Copy_Product_Traceability_2` (`ProductID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本品項的產品履歷';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_ProductAttachment`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_ProductAttachment` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品的 ID',
  `Name` varchar(50) NOT NULL,
  `Extension` varchar(7) NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`,`OrderID`,`ProductID`),
  INDEX `Idx_ORD_Copy_ProductAttachment` (`OrderID`,`ProductID`) USING BTREE,
  UNIQUE KEY `Index_UNIQUE_ORD_Copy_ProductAttachment` (`TenantID`,`OrderID`,`ProductID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本產品附加檔';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_ProductSequence`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_ProductSequence` (
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔影本的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品的 ID',
  `AppendTo` bigint(20) unsigned DEFAULT NULL,
  `Rank` VARCHAR(255) COLLATE utf8_bin DEFAULT NULL COMMENT '二進位排序規則用',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`OrderID`,`ProductID`,`TenantID`),
  INDEX `Idx_ORD_Copy_ProductSequence` (`Rank`) USING BTREE,
  INDEX `Idx_ORD_Copy_ProductSequence2` (`TenantID`,`OrderID`,`Rank`,`ProductID`) USING BTREE,
  INDEX `Idx_ORD_Copy_ProductSequence3` (`TenantID`,`OrderID`,`Rank` DESC) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本產品顯示順序';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_Seller`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_Seller` (
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔影本的 ID',
  `Name` varchar(150) DEFAULT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`OrderID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本賣家資訊';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_Seller_Mapping`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_Seller_Mapping` (
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單影本的 ID',
  `SellerID` bigint(20) unsigned NOT NULL COMMENT '對應回買家中賣家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  UNIQUE KEY `Index_UNIQUE_ORD_Copy_Seller_Mapping` (`OrderID`,`SellerID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本與對方買家中賣家主檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Copy_ShippingInfo`;
CREATE TABLE  `patiscog4sys`.`ORD_Copy_ShippingInfo` (
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔影本的 ID',
  `ShipVia` varchar(20) DEFAULT NULL COMMENT '運送方式',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `ShipTo` varchar(40) DEFAULT NULL COMMENT '收件公司',
  `Receiver` varchar(50) DEFAULT NULL COMMENT '收件人',
  `Destination` varchar(50) DEFAULT NULL COMMENT '目的地 - 港口',
  `PaymentMethod` varchar(50) DEFAULT NULL COMMENT '付款方式 - 由前端輸入',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`OrderID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '買家運送地址主檔影本';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_ExtraCharge`;
CREATE TABLE  `patiscog4sys`.`ORD_ExtraCharge` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `Name` varchar(50) NOT NULL,  
  `Type` tinyint(3) unsigned NOT NULL COMMENT '種類 - 1 = 訂單總採購金額 $, 2 = 訂單總金額 A%, 0 = 產品總採購總金額 G%, 3 = 單一產品總金額 $',
  `Amount` decimal(11,4) NOT NULL,
  `IsPriceAdjustmant` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為總價調整, 0 - false, 1 - true',
  `IsBeSeen` tinyint(1) DEFAULT 1 COMMENT '是否要輸出到報表中, 0 - false, 1 - true',
  `ProductPriceAdjustmantID` bigint(20) unsigned DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`,`OrderID`),
  INDEX `Idx_ORD_ExtraCharge` (`TenantID`,`OrderID`,`Type`) USING BTREE,
  INDEX `Idx_ORD_ExtraCharge2` (`TenantID`,`OrderID`,`IsBeSeen`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '另增收費';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Log`;
CREATE TABLE  `patiscog4sys`.`ORD_Log` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔影本的 ID',
  `Type` tinyint(1) unsigned NOT NULL,
  `Context` text DEFAULT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `OtherSiteCreatedBy` varchar(50) DEFAULT '',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單日誌';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Order`;
CREATE TABLE  `patiscog4sys`.`ORD_Order` (
  `ID` bigint(20) unsigned NOT NULL,
  `No` varchar(40) DEFAULT NULL,
  `ExpiredDate` date DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `Port` varchar(50) DEFAULT NULL COMMENT '產地',
  `TermAndCondition` text DEFAULT NULL,
  `Type` tinyint(1) unsigned DEFAULT 1 COMMENT '種類 - 1 = PO, 2 = PI',
  `Status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 (預設) = 編輯中, 1 - 已確認, 2 = 已封存, 4 = 已取消',
  `IsNeedSync` tinyint(1) unsigned DEFAULT '0' COMMENT '是否有同步資料, 0 - false, 1 - true',
  `IsSeenByOtherSite` tinyint(1) unsigned DEFAULT '0' COMMENT '對方是否已同步資料, 0 - false, 1 - true',
  `IsPaid` tinyint(1) unsigned DEFAULT '0' COMMENT '是否已付費, 0 - false, 1 - true',
  `IsEnablePay` tinyint(1) unsigned DEFAULT '0' COMMENT '是否可付費，僅正本可編輯, 0 - false, 1 - true',
  `IsFromRetail` tinyint(1) unsigned DEFAULT '0' COMMENT '是否從賣家 Retail 型錄而來, 0 - false, 1 - true',
  `StatusOfOtherSite` tinyint(1) NOT NULL DEFAULT 0 COMMENT '對方(正/副本)狀態, 0 (預設) = 編輯中, 1 - 已確認, 2 = 已封存, 4 = 已取消',
  `Payment` tinyint(1) unsigned DEFAULT '2' COMMENT '付費方式 (付費流程用), 2 - Non payment',
  `POLink` bigint(20) unsigned DEFAULT '0' COMMENT '來源PO, 對應回訂單主檔的 ID',
  `DiscussLink` bigint(20) unsigned DEFAULT '0',
  `RootLink` bigint(20) unsigned DEFAULT '0',
  `Price` decimal(11,4) DEFAULT NULL,
  `SourceCatalogName` varchar(50) DEFAULT NULL COMMENT '來源型錄名稱',
  `ShadowID` bigint(20) unsigned DEFAULT NULL COMMENT '每次公開買家使用的 ID',
  `SnapshotID` bigint(20) unsigned DEFAULT '0' COMMENT '雙方同步用快照唯一 ID',
  `ModifiedBy` bigint(20) unsigned DEFAULT '0',
  `LastModifiedDate` datetime DEFAULT NULL,
  `CreatedBy` bigint(20) unsigned DEFAULT NULL COMMENT '建立者 - 對應回公司員工主檔的 ID, 當公開買家建立訂單時，此欄位無值',
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_ORD_Order` (`TenantID`,`CreatedDate`) USING BTREE,
  INDEX `Idx_ORD_Order2` (`TenantID`,`Status`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_PaymentNumberingMachine`;
CREATE TABLE  `patiscog4sys`.`ORD_PaymentNumberingMachine` (
  `ID` varchar(36) NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔影本的 ID',
  `OtherSiteTenantID` bigint(20) unsigned DEFAULT '0' COMMENT '若非 0 者代表是買方公司主檔的 ID, 否則為公開買家',
  `IsUsed` tinyint(1) unsigned DEFAULT '0' COMMENT '是否已取用, 0 - false, 1 - true',
  `IsExported` tinyint(1) unsigned DEFAULT '0' COMMENT '是否已匯出報表, 0 - false, 1 - true',
  `IsPaid` tinyint(1) unsigned DEFAULT '0' COMMENT '是否已付費, 0 - false, 1 - true',
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回公司主檔的 ID',
  PRIMARY KEY (`ID`) USING BTREE,
  INDEX `Idx_ORD_PaymentNumberingMachine` (`CreatedDate`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單付款用號碼機';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_PriceAdjustmant`;
CREATE TABLE  `patiscog4sys`.`ORD_PriceAdjustmant` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `Type` tinyint(1) unsigned DEFAULT NULL COMMENT '種類',
  `ValueOfCondition` varchar(10) DEFAULT NULL COMMENT '限制條件之值',
  `Operator` tinyint(1) unsigned DEFAULT NULL COMMENT '運算子',
  `Value` decimal(11,4) DEFAULT NULL COMMENT '數值',
  `TypeOfCalculation` tinyint(1) unsigned DEFAULT NULL COMMENT '運算種類',
  `Description` varchar(100) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單(PI)總價調整';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Product`;
CREATE TABLE  `patiscog4sys`.`ORD_Product` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `Name` varchar(100) DEFAULT NULL,
  `SKU` varchar(100) DEFAULT NULL COMMENT 'Stock Keeping Unit No',
  `ModelNo` varchar(100) DEFAULT NULL,
  `Specification` text DEFAULT NULL,
  `Note` text DEFAULT NULL,
  `SizeUnit` tinyint(3) unsigned DEFAULT NULL,
  `Length` double(8,4) unsigned DEFAULT NULL,
  `Height` double(8,4) unsigned DEFAULT NULL,
  `Width` double(8,4) unsigned DEFAULT NULL,
  `WeightUnit` tinyint(3) unsigned DEFAULT NULL,
  `NetWeight` double(8,4) unsigned DEFAULT NULL,
  `TotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 公制',
  `ImperialTotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 英制',
  `GrossWeight` double(8,4) unsigned DEFAULT NULL,
  `UnitPerCarton` int(10) unsigned DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `Unit` varchar(50) DEFAULT NULL,
  `MOQ` int(10) unsigned DEFAULT NULL COMMENT 'Minimum Order Quantity',
  `Price` decimal(11,4) DEFAULT NULL,
  `Quantity` int(10) unsigned DEFAULT NULL,
  `TraceabilityID` bigint(20) unsigned DEFAULT '0' COMMENT '對應回供應方產品主檔的 ID',
  `IsCustomPrice` tinyint(1) unsigned NOT NULL DEFAULT 0 COMMENT '是否為客製化單價; 0 - false, 1- true',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `SNote` text DEFAULT NULL COMMENT 'Secret Note, 供正本使用',
  `Notes` text DEFAULT NULL COMMENT 'Records important remarks or considerations for both buyer and seller during the transaction',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`,`OrderID`),
  INDEX `Idx_ORD_Product` (`TenantID`,`OrderID`) USING BTREE,
  INDEX `Idx_ORD_Product_2` (`TenantID`, `OrderID`, `ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單產品主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Product_PriceAdjustmant`;
CREATE TABLE  `patiscog4sys`.`ORD_Product_PriceAdjustmant` (
  `ID` bigint(20) unsigned NOT NULL,
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品主檔的 ID',
  `Type` tinyint(1) unsigned DEFAULT 3 COMMENT '種類 - 3 = 單一產品總金額 $',
  `ValueOfCondition` varchar(10) DEFAULT NULL COMMENT '限制條件之值',
  `Operator` tinyint(1) unsigned DEFAULT NULL COMMENT '運算子',
  `Value` decimal(11,4) DEFAULT NULL COMMENT '數值',
  `TypeOfCalculation` tinyint(1) unsigned DEFAULT NULL COMMENT '運算種類',
  `Description` varchar(100) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單品項的價格調整';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Product_Traceability`;
CREATE TABLE  `patiscog4sys`.`ORD_Product_Traceability` (
  `ID` bigint(20) unsigned NOT NULL,
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品主檔的 ID',
  `Source` tinyint(1) unsigned NOT NULL COMMENT '來源代號',
  `SourceProductID` bigint(20) unsigned NOT NULL COMMENT '來源產品唯一的 ID',
  `SourceID` bigint(20) unsigned DEFAULT 0 COMMENT '來源唯一的 ID',
  `SellerID` bigint(20) unsigned DEFAULT 0 COMMENT '對應回賣家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_ORD_Product_Traceability` (`ProductID`) USING BTREE,
  INDEX `Idx_ORD_Product_Traceability_2` (`ProductID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單品項的產品履歷';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_ProductAttachment`;
CREATE TABLE  `patiscog4sys`.`ORD_ProductAttachment` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品的 ID',
  `Name` varchar(50) NOT NULL,
  `Extension` varchar(7) NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`,`OrderID`,`ProductID`),
  INDEX `Idx_ORD_ProductAttachment` (`OrderID`,`ProductID`) USING BTREE,
  INDEX `Idx_ORD_ProductAttachment2` (`TenantID`,`OrderID`,`ProductID`) USING BTREE,
  INDEX `Idx_ORD_ProductAttachment3` (`TenantID`,`OrderID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單產品附加檔';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_ProductPriceCategory`;
CREATE TABLE  `patiscog4sys`.`ORD_ProductPriceCategory` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品的 ID',
  `MOQ` int(10) unsigned NOT NULL COMMENT 'Minimum Order Quantity',
  `Price` decimal(11,4) NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_ORD_ProductPriceCategory` (`TenantID`,`OrderID`,`ProductID`) USING BTREE,
  INDEX `Idx_ORD_ProductPriceCategory2` (`OrderID`,`ProductID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單產品價格分類(正本使用)';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_ProductSequence`;
CREATE TABLE  `patiscog4sys`.`ORD_ProductSequence` (
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品的 ID',
  `AppendTo` bigint(20) unsigned DEFAULT NULL,
  `Rank` VARCHAR(255) COLLATE utf8_bin DEFAULT NULL COMMENT '二進位排序規則用',
  `Source` tinyint(1) unsigned DEFAULT 0 COMMENT '來源代號',
  `SourceProductID` bigint(20) unsigned DEFAULT 0 COMMENT '來源產品唯一的 ID',
  `SourceID` bigint(20) unsigned DEFAULT 0 COMMENT '來源唯一的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`OrderID`,`ProductID`, `AppendTo`,`TenantID`),
  INDEX `Idx_ORD_ProductSequence` (`TenantID`,`OrderID`,`ProductID`) USING BTREE,
  INDEX `Idx_ORD_ProductSequence2` (`Rank`) USING BTREE,
  INDEX `Idx_ORD_ProductSequence3` (`TenantID`,`OrderID`,`Rank`,`ProductID`) USING BTREE,
  INDEX `Idx_ORD_ProductSequence4` (`TenantID`,`OrderID`,`Rank` DESC) USING BTREE,
  INDEX `Idx_ORD_ProductSequence5` (`TenantID`,`OrderID`,`Rank` ASC) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單產品顯示順序';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Seller_Mapping`;
CREATE TABLE  `patiscog4sys`.`ORD_Seller_Mapping` (
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `SellerID` bigint(20) unsigned NOT NULL COMMENT '對應回賣家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  UNIQUE KEY `Index_UNIQUE_ORD_Seller_Mapping` (`OrderID`,`SellerID`),
  INDEX `Idx_ORD_Seller_Mapping` (`TenantID`,`OrderID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單與賣家主檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_ShippingInfo`;
CREATE TABLE  `patiscog4sys`.`ORD_ShippingInfo` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `ShipVia` varchar(20) DEFAULT NULL COMMENT '運送方式',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `ShipTo` varchar(40) DEFAULT NULL COMMENT '收件公司',
  `Receiver` varchar(50) DEFAULT NULL COMMENT '收件人',
  `Destination` varchar(50) DEFAULT NULL COMMENT '目的地 - 港口',
  `PaymentMethod` varchar(50) DEFAULT NULL COMMENT '付款方式 - 由前端輸入',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Index_UNIQUE_ORD_ShippingInfo` (`OrderID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '買家運送地址主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Seller`;
CREATE TABLE  `patiscog4sys`.`ORD_Seller` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `Name` varchar(150) DEFAULT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_ORD_Seller` (`OrderID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '賣家資訊';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_Copy_Buyer`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_Copy_Buyer` (
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(150) DEFAULT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_ORD_Snapshot_Copy_Buyer` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本買家資訊 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_Copy_Order`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_Copy_Order` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '原資料來源的 Order ID',
  `No` varchar(40) DEFAULT NULL,
  `ExpiredDate` date DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `Port` varchar(50) DEFAULT NULL,
  `TermAndCondition` text DEFAULT NULL,
  `Status` tinyint(1) NOT NULL DEFAULT 0,
  `Type` tinyint(1) unsigned DEFAULT 1,
  `Payment` tinyint(1) unsigned DEFAULT '2',
  `Price` decimal(11,4) DEFAULT NULL,
  `CreatedDate` datetime NOT NULL,
  `ModifiedBy` varchar(50) DEFAULT NULL,
  `LastModifiedDate` datetime DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_ORD_Snapshot_Copy_Order` (`ID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本主檔 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_Copy_PriceAdjustmant`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_Copy_PriceAdjustmant` (
  `ID` bigint(20) unsigned NOT NULL,
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品主檔的 ID',
  `Type` tinyint(1) unsigned DEFAULT 3 COMMENT '種類 - 3 = 單一產品總金額 $',
  `ValueOfCondition` varchar(10) DEFAULT NULL COMMENT '限制條件之值',
  `Operator` tinyint(1) unsigned DEFAULT NULL COMMENT '運算子',
  `Value` decimal(11,4) DEFAULT NULL COMMENT '數值',
  `TypeOfCalculation` tinyint(1) unsigned DEFAULT NULL COMMENT '運算種類',
  `Description` varchar(100) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`),
  INDEX `Idx_ORD_Snapshot_Copy_PriceAdjustmant` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本品項的價格調整 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_Copy_Seller`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_Copy_Seller` (
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(150) DEFAULT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_ORD_Snapshot_Copy_Seller` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本賣家資訊 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_Copy_Product`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_Copy_Product` (
  `ID` bigint(20) unsigned NOT NULL,
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(100) DEFAULT NULL,
  `SKU` varchar(100) DEFAULT NULL,
  `ModelNo` varchar(100) DEFAULT NULL,
  `Specification` text DEFAULT NULL,
  `Note` text DEFAULT NULL,
  `SizeUnit` tinyint(3) unsigned DEFAULT NULL,
  `Length` double(8,4) unsigned DEFAULT NULL,
  `Height` double(8,4) unsigned DEFAULT NULL,
  `Width` double(8,4) unsigned DEFAULT NULL,
  `WeightUnit` tinyint(3) unsigned DEFAULT NULL,
  `NetWeight` double(8,4) unsigned DEFAULT NULL,
  `TotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積',
  `ImperialTotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 英制',
  `GrossWeight` double(8,4) unsigned DEFAULT NULL,
  `UnitPerCarton` int(10) unsigned DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `Unit` varchar(50) DEFAULT NULL,
  `MOQ` int(10) unsigned DEFAULT NULL,
  `Price` decimal(11,4) DEFAULT NULL,
  `Quantity` int(10) unsigned DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `Notes` text DEFAULT NULL COMMENT 'Records important remarks or considerations for both buyer and seller during the transaction',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_ORD_Snapshot_Copy_Product` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本產品主檔 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_Copy_ProductSequence`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_Copy_ProductSequence` (
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品的 ID',
  `AppendTo` bigint(20) unsigned DEFAULT NULL,
  `Rank` VARCHAR(255) COLLATE utf8_bin DEFAULT NULL COMMENT '二進位排序規則用',
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`SnapshotID`,`ProductID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本產品顯示順序 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_Copy_ShippingInfo`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_Copy_ShippingInfo` (
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `ShipVia` varchar(20) DEFAULT NULL COMMENT '運送方式',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `ShipTo` varchar(40) DEFAULT NULL COMMENT '收件公司',
  `Receiver` varchar(50) DEFAULT NULL COMMENT '收件人',
  `Destination` varchar(50) DEFAULT NULL COMMENT '目的地 - 港口',
  `PaymentMethod` varchar(50) DEFAULT NULL COMMENT '付款方式 - 由前端輸入',
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_ORD_Snapshot_Copy_ShippingInfo` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '買家運送地址主檔影本 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_Copy_ExtraCharge`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_Copy_ExtraCharge` (
  `ID` bigint(20) unsigned NOT NULL,
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(50) NOT NULL,
  `Type` tinyint(3) unsigned NOT NULL,
  `Amount` decimal(11,4) NOT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_ORD_Snapshot_Copy_ExtraCharge` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單影本另增收費 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_Order`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_Order` (
  `ID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '原資料來源的 Order ID',
  `No` varchar(40) DEFAULT NULL,
  `ExpiredDate` date DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `Port` varchar(50) DEFAULT NULL,
  `TermAndCondition` text DEFAULT NULL,
  `Type` tinyint(1) unsigned DEFAULT 1,
  `Payment` tinyint(1) unsigned DEFAULT '2',
  `Price` decimal(11,4) DEFAULT NULL,
  `Status` tinyint(1) NOT NULL DEFAULT 0,
  `CreatedDate` datetime NOT NULL,
  `ModifiedBy` varchar(50) DEFAULT NULL,
  `LastModifiedDate` datetime DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_ORD_Snapshot_Order` (`ID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單主檔 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_Buyer`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_Buyer` (
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(150) DEFAULT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_ORD_Snapshot_Buyer` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單買家資訊 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_Seller`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_Seller` (
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(150) DEFAULT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_ORD_Snapshot_Seller` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單賣家資訊 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_PriceAdjustmant`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_PriceAdjustmant` (
  `ID` bigint(20) unsigned NOT NULL,
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品主檔的 ID',
  `Type` tinyint(1) unsigned DEFAULT 3 COMMENT '種類 - 3 = 單一產品總金額 $',
  `ValueOfCondition` varchar(10) DEFAULT NULL COMMENT '限制條件之值',
  `Operator` tinyint(1) unsigned DEFAULT NULL COMMENT '運算子',
  `Value` decimal(11,4) DEFAULT NULL COMMENT '數值',
  `TypeOfCalculation` tinyint(1) unsigned DEFAULT NULL COMMENT '運算種類',
  `Description` varchar(100) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`),
  INDEX `Idx_ORD_Snapshot_Copy_PriceAdjustmant` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單品項的價格調整 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_Product`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_Product` (
  `ID` bigint(20) unsigned NOT NULL,
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(100) DEFAULT NULL,
  `SKU` varchar(100) DEFAULT NULL,
  `ModelNo` varchar(100) DEFAULT NULL,
  `Specification` text DEFAULT NULL,
  `Note` text DEFAULT NULL,
  `SizeUnit` tinyint(3) unsigned DEFAULT NULL,
  `Length` double(8,4) unsigned DEFAULT NULL,
  `Height` double(8,4) unsigned DEFAULT NULL,
  `Width` double(8,4) unsigned DEFAULT NULL,
  `TotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積',
  `ImperialTotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 英制',
  `WeightUnit` tinyint(3) unsigned DEFAULT NULL,
  `NetWeight` double(8,4) unsigned DEFAULT NULL,
  `GrossWeight` double(8,4) unsigned DEFAULT NULL,
  `UnitPerCarton` int(10) unsigned DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `Unit` varchar(50) DEFAULT NULL,
  `MOQ` int(10) unsigned DEFAULT NULL,
  `Price` decimal(11,4) DEFAULT NULL,
  `Quantity` int(10) unsigned DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `Notes` text DEFAULT NULL COMMENT 'Records important remarks or considerations for both buyer and seller during the transaction',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_ORD_Snapshot_Product` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單產品主檔 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_ProductSequence`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_ProductSequence` (
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品的 ID',
  `AppendTo` bigint(20) unsigned DEFAULT NULL,
  `Rank` VARCHAR(255) COLLATE utf8_bin DEFAULT NULL COMMENT '二進位排序規則用',
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`SnapshotID`,`ProductID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單產品顯示順序 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_ShippingInfo`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_ShippingInfo` (
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `ShipVia` varchar(20) DEFAULT NULL COMMENT '運送方式',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `ShipTo` varchar(40) DEFAULT NULL COMMENT '收件公司',
  `Receiver` varchar(50) DEFAULT NULL COMMENT '收件人',
  `Destination` varchar(50) DEFAULT NULL COMMENT '目的地 - 港口',
  `PaymentMethod` varchar(50) DEFAULT NULL COMMENT '付款方式 - 由前端輸入',
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_ORD_Snapshot_ShippingInfo` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '買家運送地址主檔 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`ORD_Snapshot_ExtraCharge`;
CREATE TABLE  `patiscog4sys`.`ORD_Snapshot_ExtraCharge` (
  `ID` bigint(20) unsigned NOT NULL,
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(50) NOT NULL,
  `Type` tinyint(3) unsigned NOT NULL,
  `Amount` decimal(11,4) NOT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_ORD_Snapshot_ExtraCharge` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '訂單另增收費 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_Category`;
CREATE TABLE  `patiscog4sys`.`PARAM_Category` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL DEFAULT '',
  `ParentID` bigint(20) unsigned NOT NULL,
  `Sequence` int(3) unsigned DEFAULT NULL,
  `IsFromSeller` tinyint(1) unsigned DEFAULT '0' COMMENT '來源是否來自賣家產品分類, 0 - false, 1 - true',
  `IsDefault` tinyint(1) unsigned DEFAULT '0' COMMENT '是否是預設, 0 - false, 1 - true',
  `IsHidden` tinyint(1) unsigned DEFAULT '0' COMMENT '是否是隱藏, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`),
  INDEX `Idx_PARAM_Category` (`TenantID`,`ParentID`) USING BTREE,
  INDEX `Idx_PARAM_Category2` (`TenantID`, `ID`,`ParentID`) USING BTREE,
  INDEX `Idx_PARAM_Category3` (`TenantID`, `ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品分類主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_CategoryInternationalization`;
CREATE TABLE  `patiscog4sys`.`PARAM_CategoryInternationalization` (
  `ParamCategoryID` bigint(20) unsigned NOT NULL COMMENT '對應回產品分類主檔的 ID',
  `LanguageID` bigint(20) unsigned NOT NULL COMMENT '對應回系統多語系設定主檔的 ID',
  `Name` varchar(100) DEFAULT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`TenantID`,`ParamCategoryID`,`LanguageID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品分類主檔_多語系設定';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_CategoriesOfPublicFile`;
CREATE TABLE  `patiscog4sys`.`PARAM_CategoriesOfPublicFile` (
  `PublicFileID` bigint(20) unsigned NOT NULL COMMENT '對應回公用檔案的 ID',
  `CategoryID` bigint(20) unsigned NOT NULL COMMENT '對應回公用檔案用分類檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`CategoryID`,`PublicFileID`),
  INDEX `Idx_PARAM_CategoriesOfPublicFile` (`TenantID`, `PublicFileID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該公用檔案與公用檔案用分類檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_Department`;
CREATE TABLE  `patiscog4sys`.`PARAM_Department` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(150) NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '公司部門';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_DiscussGroup`;
CREATE TABLE  `patiscog4sys`.`PARAM_DiscussGroup` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(150) NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '討論群組';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_ExchangeRate`;
CREATE TABLE  `patiscog4sys`.`PARAM_ExchangeRate` (
  `ID` bigint(20) unsigned NOT NULL,
  `OriCurrency` smallint(3) NOT NULL,
  `ToCurrency` smallint(3) NOT NULL,
  `ExchangeRate` decimal(10,5) NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Index_UNIQUE_PARAM_ExchangeRate` (`OriCurrency`,`ToCurrency`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '匯率對照';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_GoogleOAuthRefreshToken;
CREATE TABLE  `patiscog4sys`.`PARAM_GoogleOAuthRefreshToken` (
  `UserID` bigint(20) unsigned NOT NULL COMMENT '對應回公司員工主檔的 ID',
  `StoreID` bigint(20) unsigned NOT NULL COMMENT 'token store 儲存用 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`UserID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '紀錄某一個租戶使用者所使用的 Google OAuth refresh token 位置';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_I18N`;
CREATE TABLE  `patiscog4sys`.`PARAM_I18N` (
  `LanguageID` bigint(20) unsigned NOT NULL COMMENT '對應回系統多語系設定主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`TenantID`,`LanguageID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '多語系設定';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_Job`;
CREATE TABLE  `patiscog4sys`.`PARAM_Job` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '職稱';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_MembersOfGroup`;
CREATE TABLE  `patiscog4sys`.`PARAM_MembersOfGroup` (
  `GroupID` bigint(20) unsigned NOT NULL COMMENT '對應回討論群組檔的 ID',
  `MemberID` bigint(20) unsigned NOT NULL,
  `Type` tinyint(1) unsigned NOT NULL COMMENT '種類 - 1 = Inside, 2 = Buyer, 3 = Seller',
  `SourceID` bigint(20) unsigned NOT NULL COMMENT '來源唯一的 ID',
  `SourceContactID` bigint(20) unsigned DEFAULT '0' COMMENT '來源的對應窗口 ID',
  `SourceContactName` varchar(50) DEFAULT '' COMMENT '來源的對應窗口名稱',
  `TenantID` bigint(20) unsigned NOT NULL,
  UNIQUE KEY `Index_UNIQUE_PARAM_MembersOfGroup` (`GroupID`,`MemberID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '討論群組成員';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_Note`;
CREATE TABLE  `patiscog4sys`.`PARAM_Note` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `Context` text NOT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_PARAM_Note` (`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '其他資訊範本主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_PaymentSetup`;
CREATE TABLE  `patiscog4sys`.`PARAM_PaymentSetup` (
  `ID` bigint(20) unsigned NOT NULL,
  `Type` tinyint(1) unsigned NOT NULL COMMENT '線上付款類型: 2 - Non payment, 1 - Paypal, 3 - E.SUN BANK, 4 - PAYUNi',
  `Value` varchar(1000) DEFAULT NULL COMMENT '設定值: PayPal - App Name, 玉山金流 - MAC KEY, PAYUNi - MerID',
  `StoreID` VARCHAR(64) DEFAULT NULL COMMENT '擴充資料 - 玉山金流用特店代碼',
  `StoreName` VARCHAR(150) DEFAULT NULL COMMENT '擴充資料 - 玉山金流用特店名稱',
  `ClientID` VARCHAR(81) DEFAULT NULL COMMENT '擴充資料 - PayPal 用 Client ID; PAYUNi 用 MerKey',
  `Secret` VARCHAR(81) DEFAULT NULL COMMENT '擴充資料 - PayPal 用 Secret; PAYUNi 用 MerIV',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '收款設定';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_PriceAdjustmant`;
CREATE TABLE  `patiscog4sys`.`PARAM_PriceAdjustmant` (
  `ID` bigint(20) unsigned NOT NULL,
  `PrincipleID` bigint(20) unsigned NOT NULL COMMENT '對應回報價原則檔的 ID',
  `Type` tinyint(1) unsigned NOT NULL COMMENT '種類',
  `ValueOfCondition` varchar(10) NOT NULL COMMENT '運算元',
  `Operator` tinyint(1) unsigned NOT NULL COMMENT '加/減',
  `Value` decimal(11,4) NOT NULL COMMENT '值',
  `TypeOfCalculation` tinyint(1) unsigned NOT NULL COMMENT '單位',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價原則之單價調整';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_Principle`;
CREATE TABLE  `patiscog4sys`.`PARAM_Principle` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `RoundedType` tinyint(1) unsigned NOT NULL COMMENT '1: 是否四捨五入; 2: 是否無條件捨去; 3:是否無條件進位',
  `AccurateTo` tinyint(1) unsigned NOT NULL COMMENT '精準度',
  `CurrencyCode` smallint(5) unsigned NOT NULL,
  `TradingCode` tinyint(3) unsigned NOT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價原則';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_ProductPriceCategory`;
CREATE TABLE  `patiscog4sys`.`PARAM_ProductPriceCategory` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(150) NOT NULL,
  `Note` text DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '公司總價格分類';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_ProductUnit`;
CREATE TABLE  `patiscog4sys`.`PARAM_ProductUnit` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL DEFAULT '',
  `Code` tinyint(3) unsigned DEFAULT NULL COMMENT '與其他系統用交換碼',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品單位主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_ProductUnit_Mapping`;
CREATE TABLE `patiscog4sys`.`PARAM_ProductUnit_Mapping` (
  `SourceTenantID` BIGINT(20) UNSIGNED NOT NULL COMMENT 'The unique ID of the source tenant.',
  `SourceUnitID` BIGINT(20) UNSIGNED NOT NULL COMMENT 'The unique ID of the product unit in the source tenant.',
  `TargetTenantID` BIGINT(20) UNSIGNED NOT NULL COMMENT 'The unique ID of the target tenant.',
  `TargetUnitID` BIGINT(20) UNSIGNED NOT NULL COMMENT 'The unique ID of the product unit in the target tenant.',
  `Status` TINYINT(1) UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Mapping status: 1=Active, 2=TargetMissing.',
  `CreatedBy` BIGINT(20) UNSIGNED NOT NULL COMMENT 'The user ID of the creator.',
  `CreatedDate` DATETIME NOT NULL COMMENT 'The timestamp when the mapping was created.',
  INDEX `Idx_PARAM_ProductUnit_Mapping` (`SourceTenantID`, `SourceUnitID`) USING BTREE,
  INDEX `Idx_PARAM_ProductUnit_Mapping_2` (`TargetTenantID`, `TargetUnitID`) USING BTREE,
  INDEX `Idx_PARAM_ProductUnit_Mapping_3` (`SourceTenantID`, `SourceUnitID`, `Status`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='Stores one-to-one product unit mappings between tenants.';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_ProductUnitInternationalization`;
CREATE TABLE  `patiscog4sys`.`PARAM_ProductUnitInternationalization` (
  `ProductUnitID` bigint(20) unsigned NOT NULL COMMENT '對應回產品單位主檔的 ID',
  `LanguageID` bigint(20) unsigned NOT NULL COMMENT '對應回系統多語系設定主檔的 ID',
  `Name` varchar(50) DEFAULT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`TenantID`,`ProductUnitID`,`LanguageID`),
  INDEX `Idx_PARAM_ProductUnitInternationalization_i18n` (`ProductUnitID`, `LanguageID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品單位主檔_多語系設定';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_PublicFile`;
CREATE TABLE  `patiscog4sys`.`PARAM_PublicFile` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `Extension` varchar(7) NOT NULL,
  `Description` varchar(100) DEFAULT NULL,
  `Size` bigint(20) unsigned DEFAULT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_PARAM_PublicFile` (`TenantID`,`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '公用檔案主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_PublicFile_Usage_History`;
CREATE TABLE  `patiscog4sys`.`PARAM_PublicFile_Usage_History` (
  `ID` bigint(20) unsigned NOT NULL,
  `PID` bigint(20) unsigned NOT NULL COMMENT '對應回公用檔案主檔的 ID',
  `Type` tinyint(1) unsigned NOT NULL COMMENT '種類 - 1 : Product, 2 : Discuss, 3: Catalog',
  `TargetID` bigint(20) unsigned NOT NULL COMMENT '對象 - 來源唯一 ID',
  `IsValid` tinyint(1) DEFAULT 1 COMMENT '0 = 失效, 1 (預設) = 有效',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_PARAM_PublicFile_Usage_History` (`PID`,`IsValid`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '公用檔案的使用紀錄檔';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_PublicFilesUseCategory`;
CREATE TABLE  `patiscog4sys`.`PARAM_PublicFilesUseCategory` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `ParentID` bigint(20) unsigned DEFAULT '0' COMMENT '0 - 第一層',
  `IsDefault` tinyint(1) unsigned DEFAULT '0' COMMENT '是否是預設, 0 - false, 1 - true',
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`, `TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '公用檔案用分類檔';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_ReportHeader`;
CREATE TABLE  `patiscog4sys`.`PARAM_ReportHeader` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `Extension` varchar(7) NOT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報告擋頭主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_SellerCatalogSequence`;
CREATE TABLE  `patiscog4sys`.`PARAM_SellerCatalogSequence` (
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '賣家提供的型錄主檔 ID',
  `UserID` bigint(20) unsigned NOT NULL COMMENT '對應回公司員工主檔的 ID',
  `AppendTo` bigint(20) unsigned DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`CatalogID`,`UserID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '某個買家的某個賣家目錄顯示順序';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_ShippingInfo`;
CREATE TABLE  `patiscog4sys`.`PARAM_ShippingInfo` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `ShipVia` varchar(20) DEFAULT NULL COMMENT '運送方式',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `ShipTo` varchar(40) DEFAULT NULL COMMENT '收件公司',
  `Receiver` varchar(50) DEFAULT NULL COMMENT '收件人',
  `Destination` varchar(50) DEFAULT NULL COMMENT '目的地 - 港口',
  `PaymentMethod` varchar(50) DEFAULT NULL COMMENT '付款方式 - 由前端輸入',
  `IsDefault` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為預設, 0 - false, 1 - true',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '運送地址';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_ShopifySetup`;
CREATE TABLE  `patiscog4sys`.`PARAM_ShopifySetup` (
  `ID` bigint(20) unsigned NOT NULL,
  `StoreID` VARCHAR(64) NOT NULL COMMENT '商店代碼',
  `AccessToken` VARCHAR(81) NOT NULL COMMENT '管理介面 API 存取憑證',
  `Description` varchar(150) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Index_UNIQUE_ShopifySetup` (`StoreID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = 'Shopify 商店設定';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_SubDomainSetup`;
CREATE TABLE  `patiscog4sys`.`PARAM_SubDomainSetup` (
  `TenantID` bigint(20) unsigned NOT NULL,
  `HasImage` tinyint(1) unsigned DEFAULT '0' COMMENT '是否有圖片, 0 - false, 1 - true',
  `Value` varchar(63) NOT NULL,
  `BuyerRequestID` varchar(36) DEFAULT 0 COMMENT '登入頁用買家邀請請求 ID, 0 (預設) 代表不使用登入頁面不使用買家邀請',
  PRIMARY KEY (`TenantID`),
  UNIQUE KEY `Index_UNIQUE_SubDomainSetup` (`Value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = 'Subdomain設定';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_ThemeSetup`;
CREATE TABLE  `patiscog4sys`.`PARAM_ThemeSetup` (
  `TenantID` bigint(20) unsigned NOT NULL,
  `MainPageColor` varchar(7) DEFAULT '#ff3d77' COMMENT 'Main Theme Color - hexadecimal string',
  `CatalogColor` varchar(7) DEFAULT '#ff3d77' COMMENT 'Catalog Theme Color - hexadecimal string',
  `MainPageAlpha` tinyint(3) unsigned DEFAULT '100' COMMENT 'Main Theme Opacity, 0 - 100',
  `CatalogAlpha` tinyint(3) unsigned DEFAULT '100' COMMENT 'Catalog Opacity, 0 - 100',
  PRIMARY KEY (`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = 'Theme設定';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_Widgets4Display`;
CREATE TABLE  `patiscog4sys`.`PARAM_Widgets4Display` (
  `WidgetID` bigint(20) unsigned NOT NULL COMMENT '前端 UI 定義的 Widget ID',
  `UserID` bigint(20) unsigned NOT NULL COMMENT '對應回公司員工主檔的 ID',
  `IsEnabled` tinyint(1) DEFAULT 1 COMMENT '0 = 停用, 1 (預設) = 啟用',
  `TenantID` bigint(20) unsigned NOT NULL,
  UNIQUE KEY `Index_UNIQUE_Widgets4Display` (`WidgetID`,`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '使用者 Widget 顯示設定';

DROP TABLE IF EXISTS `patiscog4sys`.`PARAM_WishList`;
CREATE TABLE  `patiscog4sys`.`PARAM_WishList` (
  `ID` bigint(20) unsigned NOT NULL,
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '賣家提供的型錄主檔 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '賣家提供的產品主檔 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_PARAM_WishList` (`CatalogID`,`ProductID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '買家於某個賣家目錄的希望清單';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_Attachment`;
CREATE TABLE  `patiscog4sys`.`PRD_Attachment` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `Extension` varchar(7) NOT NULL,
  `Description` varchar(100) DEFAULT NULL COMMENT '文字描述',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`),
  INDEX `Idx_PRD_Attachment` (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品附加檔主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_AttachmentsOfProduct`;
CREATE TABLE  `patiscog4sys`.`PRD_AttachmentsOfProduct` (
  `AttachmentID` bigint(20) unsigned NOT NULL COMMENT '對應回產品附加檔主檔 / 公用檔案的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回產品主檔的 ID',
  `Sequence` tinyint(2) unsigned NOT NULL,
  `Type` tinyint(1) unsigned DEFAULT 1 COMMENT '種類 - 1 = 產品附加檔, 2 = 公用檔案',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_PRD_Attachment` (`TenantID`,`ProductID`) USING BTREE,
  INDEX `Idx_PRD_Attachment2` (`ProductID`) USING BTREE,
  INDEX `Idx_PRD_Attachment3` (`ProductID`,`Sequence`) USING BTREE,
  INDEX `Idx_PRD_Attachment4` (`TenantID`,`ProductID`,`Type`,`Sequence`) USING BTREE,
  INDEX `Idx_PRD_Attachment5` (`TenantID`,`ProductID`,`Sequence`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該產品附加檔 / 公用檔案與產品的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_BatchImportTimeStamp`;
CREATE TABLE  `patiscog4sys`.`PRD_BatchImportTimeStamp` (
  `TimeStamp` varchar(19) NOT NULL,
  `IsValid` tinyint(1) DEFAULT 1 COMMENT '0 = 失效, 1 (預設) = 有效',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`TimeStamp`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品批次新增範本檔用時戳';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_CategoriesOfProduct`;
CREATE TABLE  `patiscog4sys`.`PRD_CategoriesOfProduct` (
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回產品主檔的 ID',
  `CategoryID` bigint(20) unsigned NOT NULL COMMENT '對應回產品分類主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_PRD_CategoriesOfProduct` (`CategoryID`,`ProductID`) USING BTREE,
  INDEX `Idx_PRD_CategoriesOfProduct_2` (`ProductID`) USING BTREE,
  INDEX `Idx_PRD_CategoriesOfProduct_3` (`TenantID`,`CategoryID`,`ProductID`) USING BTREE,
  UNIQUE KEY `Index_UNIQUE_PRD_CategoriesOfProduct` (`CategoryID`,`ProductID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該產品與產品分類主檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_Grouping`;
CREATE TABLE  `patiscog4sys`.`PRD_Grouping` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(100) NOT NULL DEFAULT '',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品群組主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_GroupingOfProduct`;
CREATE TABLE  `patiscog4sys`.`PRD_GroupingOfProduct` (
  `GroupID` bigint(20) unsigned NOT NULL COMMENT '對應回產品群組主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回產品主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`GroupID`,`ProductID`,`TenantID`),
  INDEX `Idx_PRD_GroupingOfProduct` (`ProductID`) USING BTREE,
  INDEX `Idx_PRD_GroupingOfProduct2` (`ProductID`,`GroupID`) USING BTREE,
  INDEX `Idx_PRD_GroupingOfProduct3` (`TenantID`,`ProductID`) USING BTREE,
  INDEX `Idx_PRD_GroupingOfProduct_4` (`ProductID`,`GroupID`,`TenantID`) USING BTREE,
  INDEX `Idx_PRD_GroupingOfProduct_5` (`TenantID`,`GroupID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '該產品與產品群組主檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_Log`;
CREATE TABLE  `patiscog4sys`.`PRD_Log` (
  `ID` bigint(20) unsigned NOT NULL,
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回產品主檔的 ID',
  `Type` tinyint(1) unsigned NOT NULL COMMENT '操作代號',
  `ModifiedBy` bigint(20) unsigned NOT NULL,
  `ModifiedDate` timestamp NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_PRD_Log` (`ProductID`,`Type`) USING BTREE,
  INDEX `Idx_PRD_Log2` (`ProductID`,`Type`, `ModifiedDate` DESC) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品編輯日誌';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_PriceCategory`;
CREATE TABLE  `patiscog4sys`.`PRD_PriceCategory` (
  `ID` bigint(20) unsigned NOT NULL,
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回產品主檔的 ID',
  `MOQ` int(10) unsigned NOT NULL COMMENT 'Minimum Order Quantity',
  `Price` decimal(11,4) NOT NULL,
  `PriceCategoryID` bigint(20) unsigned DEFAULT '0' COMMENT '公司總價格分類中 ID 供更新同步用',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_PRD_PriceCategory` (`TenantID`,`ProductID`) USING BTREE,
  INDEX `Idx_PRD_PriceCategory_2` (`ProductID`,`MOQ`) USING BTREE,
  INDEX `Idx_PRD_PriceCategory_3` (`TenantID`,`PriceCategoryID`) USING BTREE,
  INDEX `Idx_PRD_PriceCategory_4` (`TenantID`, `ProductID`,`MOQ` desc) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品價格分類';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_Product`;
CREATE TABLE  `patiscog4sys`.`PRD_Product` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(100) DEFAULT NULL,
  `SKU` varchar(100) DEFAULT NULL COMMENT 'Stock Keeping Unit No',
  `ModelNo` varchar(100) DEFAULT NULL,
  `Specification` text DEFAULT NULL,
  `Note` text DEFAULT NULL,
  `Packaging` text DEFAULT NULL,
  `SizeUnit` tinyint(3) unsigned DEFAULT NULL,
  `Length` double(8,4) unsigned DEFAULT NULL,
  `Height` double(8,4) unsigned DEFAULT NULL,
  `Width` double(8,4) unsigned DEFAULT NULL,
  `TotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 公制',
  `ImperialTotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 英制',
  `WeightUnit` tinyint(3) unsigned DEFAULT NULL,
  `NetWeight` double(11,4) unsigned DEFAULT NULL,
  `GrossWeight` double(11,4) unsigned DEFAULT NULL,
  `UnitPerCarton` int(10) unsigned DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `MSRP` decimal(11,4) DEFAULT NULL COMMENT 'Manufacturer Suggested Retail Price',
  `Unit` varchar(50) DEFAULT NULL COMMENT '舊版設計',
  `UnitID` bigint(20) unsigned DEFAULT 0 COMMENT '對應回產品單位主檔的 ID, 取代 Unit 欄位設計',
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `PlaceOfOrigin` varchar(20) DEFAULT NULL,
  `Warranty` double(5,2) DEFAULT NULL,
  `Stock` int(10) unsigned DEFAULT 0,
  `Certification` varchar(200) DEFAULT NULL,
  `Supplier` bigint(20) unsigned DEFAULT NULL COMMENT '供應商 ID, 對應回賣家主檔的 ID',
  `Status` tinyint(1) NOT NULL COMMENT '目前狀態',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `ModifiedBy` bigint(20) unsigned NOT NULL DEFAULT '0',
  `ModifiedDate` datetime DEFAULT NULL,
  `PublishedDate` datetime DEFAULT NULL,
  `SNote` text DEFAULT NULL COMMENT 'Secret Note, 供正本使用',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_PRD_Product` (`TenantID`,`Status`,`SKU`,`CreatedDate`) USING BTREE,
  INDEX `Idx_PRD_Product_2` (`ID`,`Status`) USING BTREE,
  INDEX `Idx_PRD_Product_3` (`TenantID`,`ID`,`Status`) USING BTREE,
  INDEX `Idx_PRD_Product_4` (`TenantID`,`ID`) USING BTREE,
  INDEX `Idx_PRD_Product_5` (`TenantID`,`ID`,`PublishedDate`,`CreatedDate`,`Status`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_ProductInternationalization`;
CREATE TABLE  `patiscog4sys`.`PRD_ProductInternationalization` (
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回產品主檔的 ID',
  `LanguageID` bigint(20) unsigned NOT NULL COMMENT '對應回系統多語系設定主檔的 ID',
  `Name` varchar(100) DEFAULT NULL,
  `Specification` text DEFAULT NULL,
  `Note` text DEFAULT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`TenantID`,`ProductID`,`LanguageID`),
  INDEX `Idx_PRD_ProductInternationalization_i18n` (`ProductID`,`LanguageID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品_多語系設定';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_Option`;
CREATE TABLE  `patiscog4sys`.`PRD_Option` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_PRD_Option` (`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品的動態屬性 key 名稱';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_Traceability`;
CREATE TABLE  `patiscog4sys`.`PRD_Traceability` (
  `ID` bigint(20) unsigned NOT NULL,
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回產品主檔的 ID',
  `Source` tinyint(1) unsigned NOT NULL COMMENT '來源代號',
  `SourceProductID` bigint(20) unsigned NOT NULL COMMENT '來源產品唯一的 ID',
  `SourceID` bigint(20) unsigned DEFAULT 0 COMMENT '來源唯一的 ID',
  `SellerName` varchar(50) DEFAULT '',
  `CatalogName` varchar(50) DEFAULT '',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_PRD_Traceability` (`ProductID`) USING BTREE,
  INDEX `Idx_PRD_Traceability2` (`ProductID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品履歷';

DROP TABLE IF EXISTS `patiscog4sys`.`PRD_ValuesOfOption`;
CREATE TABLE  `patiscog4sys`.`PRD_ValuesOfOption` (
  `ID` bigint(20) unsigned NOT NULL,
  `OptionID` bigint(20) unsigned NOT NULL COMMENT '對應回產品的動態屬性 key 名稱的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回產品主檔的 ID',
  `Value` varchar(50) NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_PRD_ValuesOfOption` (`TenantID`,`ProductID`,`OptionID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '產品的動態屬性 key 值';

DROP TABLE IF EXISTS `patiscog4sys`.`PWD_ForgetPasswordNumberingMachine`;
CREATE TABLE  `patiscog4sys`.`PWD_ForgetPasswordNumberingMachine` (
  `ID` varchar(36) NOT NULL,
  `LoginID` varchar(50) NOT NULL,
  `IsSent` tinyint(1) unsigned DEFAULT '0' COMMENT '是否已寄發信件, 0 - false, 1 - true',
  `IsUsed` tinyint(1) unsigned DEFAULT '0' COMMENT '是否已取用, 0 - false, 1 - true',
  `CreatedDate` datetime NOT NULL,
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '忘記密碼用號碼機';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Buyer`;
CREATE TABLE  `patiscog4sys`.`QUO_Buyer` (
  `ID` bigint(20) unsigned NOT NULL,
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單主檔的 ID',
  `Name` varchar(150) NOT NULL DEFAULT '',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單買家資訊';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Buyer_Mapping`;
CREATE TABLE  `patiscog4sys`.`QUO_Buyer_Mapping` (
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單主檔的 ID',
  `BuyerID` bigint(20) unsigned NOT NULL COMMENT '對應回買家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  UNIQUE KEY `Index_UNIQUE_QUO_Buyer_Mapping` (`QuotationID`,`BuyerID`),
  INDEX `Idx_QUO_Buyer_Mapping` (`TenantID`, `QuotationID`) USING BTREE,
  INDEX `Idx_QUO_Buyer_Mapping_2` (`TenantID`,`BuyerID`, `QuotationID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單與買家主檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Copy_Buyer`;
CREATE TABLE  `patiscog4sys`.`QUO_Copy_Buyer` (
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回報價單影本主檔的 ID',
  `Name` varchar(150) NOT NULL DEFAULT '',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`QuotationID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單影本買家資訊';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Copy_ProductAttachment`;
CREATE TABLE  `patiscog4sys`.`QUO_Copy_ProductAttachment` (
  `ID` bigint(20) unsigned NOT NULL,
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單產品的 ID',
  `Name` varchar(50) NOT NULL,
  `Extension` varchar(7) NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`,`QuotationID`,`ProductID`),
  UNIQUE KEY `Index_UNIQUE_QUO_Copy_ProductAttachment` (`TenantID`,`QuotationID`,`ProductID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '詢報價單影本產品附加檔';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Copy_ProductPriceCategory`;
CREATE TABLE  `patiscog4sys`.`QUO_Copy_ProductPriceCategory` (
  `ID` bigint(20) unsigned NOT NULL,
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單產品的 ID',
  `MOQ` int(10) unsigned NOT NULL COMMENT 'Minimum Order Quantity',
  `Price` decimal(11,4) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_QUO_Copy_ProductPriceCategory` (`TenantID`,`QuotationID`,`ProductID`) USING BTREE,
  UNIQUE KEY `Index_UNIQUE_QUO_Copy_ProductPriceCategory` (`QuotationID`,`ProductID`,`MOQ`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單影本產品價格分類';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Copy_Log`;
CREATE TABLE  `patiscog4sys`.`QUO_Copy_Log` (
  `ID` bigint(20) unsigned NOT NULL,
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回報價單影本主檔的 ID',
  `Type` tinyint(1) unsigned NOT NULL,
  `Context` text DEFAULT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `OtherSiteCreatedBy` varchar(50) DEFAULT '',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單影本日誌';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Copy_Product`;
CREATE TABLE  `patiscog4sys`.`QUO_Copy_Product` (
  `ID` bigint(20) unsigned NOT NULL,
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回報價單影本主檔的 ID',
  `Name` varchar(100) DEFAULT NULL,
  `SKU` varchar(100) DEFAULT NULL COMMENT 'Stock Keeping Unit No',
  `ModelNo` varchar(100) DEFAULT NULL,
  `Specification` text DEFAULT NULL,
  `Note` text DEFAULT NULL,
  `SizeUnit` tinyint(3) unsigned DEFAULT NULL,
  `Length` double(8,4) unsigned DEFAULT NULL,
  `Height` double(8,4) unsigned DEFAULT NULL,
  `Width` double(8,4) unsigned DEFAULT NULL,
  `TotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 公制',
  `ImperialTotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 英制',
  `WeightUnit` tinyint(3) unsigned DEFAULT NULL,
  `NetWeight` double(8,4) unsigned DEFAULT NULL,
  `GrossWeight` double(8,4) unsigned DEFAULT NULL,
  `UnitPerCarton` int(10) unsigned DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `Unit` varchar(50) DEFAULT NULL,
  `MOQ` int(10) unsigned DEFAULT NULL COMMENT 'Minimum Order Quantity',
  `Price` decimal(11,4) DEFAULT NULL,
  `Quantity` int(10) unsigned DEFAULT NULL,
  `TraceabilityID` bigint(20) unsigned DEFAULT '0' COMMENT '對應回供應方產品主檔的 ID',
  `Notes` text DEFAULT NULL COMMENT 'Records important remarks or considerations for both buyer and seller during the transaction',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`QuotationID`,`TenantID`),
  INDEX `Idx_QUO_Copy_Product_1` (`TenantID`, `QuotationID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單影本產品主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Copy_Quote`;
CREATE TABLE  `patiscog4sys`.`QUO_Copy_Quote` (
  `ID` bigint(20) unsigned NOT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `Port` varchar(50) DEFAULT NULL,
  `ExpiredDate` date DEFAULT NULL,
  `No` varchar(40) DEFAULT NULL,
  `TermAndCondition` text DEFAULT NULL,
  `Status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 = 編輯中, 1 (預設) = 已確認, 2 = 已封存',
  `Type` tinyint(1) unsigned DEFAULT 1 COMMENT '種類 - 1 = 報價單, 2 = 詢價單',
  `IsNeedSync` tinyint(1) unsigned DEFAULT '0' COMMENT '是否有同步資料, 0 - false, 1 - true',
  `IsSeenByOtherSite` tinyint(1) unsigned DEFAULT '0' COMMENT '對方是否已同步資料, 0 - false, 1 - true',
  `DiscussLink` bigint(20) unsigned DEFAULT '0',
  `SnapshotID` bigint(20) unsigned DEFAULT '0',
  `ModifiedBy` bigint(20) unsigned DEFAULT '0',
  `LastModifiedDate` datetime DEFAULT NULL,
  `CreatedDate` datetime NOT NULL,
  `OriTenantID` bigint(20) unsigned NOT NULL COMMENT '對應回邀請方公司主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`, `TenantID`),
  INDEX `Idx_QUO_Copy_Quote_1` (`TenantID`, `Status`, `Type`, `CreatedDate`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單影本主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Copy_Seller`;
CREATE TABLE  `patiscog4sys`.`QUO_Copy_Seller` (
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回報價單影本主檔的 ID',
  `Name` varchar(150) NOT NULL DEFAULT '',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`QuotationID`,`TenantID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單影本賣家資訊';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Copy_Product_Traceability`;
CREATE TABLE  `patiscog4sys`.`QUO_Copy_Product_Traceability` (
  `ID` bigint(20) unsigned NOT NULL,
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單影本產品主檔的 ID',
  `Source` tinyint(1) unsigned NOT NULL COMMENT '來源代號',
  `SourceProductID` bigint(20) unsigned NOT NULL COMMENT '來源產品唯一的 ID',
  `SourceID` bigint(20) unsigned DEFAULT 0 COMMENT '來源唯一的 ID',
  `SellerID` bigint(20) unsigned DEFAULT 0 COMMENT '對應回賣家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_QUO_Copy_Product_Traceability` (`ProductID`) USING BTREE,
  INDEX `Idx_QUO_Copy_Product_Traceability_2` (`ProductID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '詢報價單影本品項的產品履歷';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Copy_Buyer_Mapping`;
CREATE TABLE  `patiscog4sys`.`QUO_Copy_Buyer_Mapping` (
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回報價單影本的 ID',
  `BuyerID` bigint(20) unsigned NOT NULL COMMENT '對應回賣家中買家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  UNIQUE KEY `Index_UNIQUE_QUO_Copy_Buyer_Mapping` (`QuotationID`,`BuyerID`),
  INDEX `Idx_QUO_Copy_Buyer_Mapping_1` (`TenantID`, `QuotationID`) USING BTREE,
  INDEX `Idx_QUO_Copy_Buyer_Mapping_2` (`TenantID`, `BuyerID`, `QuotationID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單影本與買家主檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Copy_Seller_Mapping`;
CREATE TABLE  `patiscog4sys`.`QUO_Copy_Seller_Mapping` (
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回報價單影本的 ID',
  `SellerID` bigint(20) unsigned NOT NULL COMMENT '對應回買家中賣家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  UNIQUE KEY `Index_UNIQUE_QUO_Copy_Seller_Mapping` (`QuotationID`,`SellerID`),
  INDEX `Idx_QUO_Copy_Seller_Mapping_1` (`TenantID`, `QuotationID`) USING BTREE,
  INDEX `Idx_QUO_Copy_Seller_Mapping_2` (`TenantID`, `SellerID`, `QuotationID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單影本與對方買家中賣家主檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Log`;
CREATE TABLE  `patiscog4sys`.`QUO_Log` (
  `ID` bigint(20) unsigned NOT NULL,
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單主檔的 ID',
  `Type` tinyint(1) unsigned NOT NULL,
  `Context` text DEFAULT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `OtherSiteCreatedBy` varchar(50) DEFAULT '',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單日誌';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Product`;
CREATE TABLE  `patiscog4sys`.`QUO_Product` (
  `ID` bigint(20) unsigned NOT NULL,
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單主檔的 ID',
  `Name` varchar(100) DEFAULT NULL,
  `SKU` varchar(100) DEFAULT NULL COMMENT 'Stock Keeping Unit No',
  `ModelNo` varchar(100) DEFAULT NULL,
  `Specification` text DEFAULT NULL,
  `Note` text DEFAULT NULL,
  `SizeUnit` tinyint(3) unsigned DEFAULT NULL,
  `Length` double(8,4) unsigned DEFAULT NULL,
  `Height` double(8,4) unsigned DEFAULT NULL,
  `Width` double(8,4) unsigned DEFAULT NULL,
  `TotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 公制',
  `ImperialTotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 英制',
  `WeightUnit` tinyint(3) unsigned DEFAULT NULL,
  `NetWeight` double(8,4) unsigned DEFAULT NULL,
  `GrossWeight` double(8,4) unsigned DEFAULT NULL,
  `UnitPerCarton` int(10) unsigned DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `Unit` varchar(50) DEFAULT NULL,
  `MOQ` int(10) unsigned DEFAULT NULL COMMENT 'Minimum Order Quantity',
  `IsCustomPrice` tinyint(1) unsigned NOT NULL DEFAULT 0 COMMENT '是否為客製化單價; 0 - false, 1- true',
  `Price` decimal(11,4) DEFAULT NULL,
  `Quantity` int(10) unsigned DEFAULT NULL,
  `TraceabilityID` bigint(20) unsigned DEFAULT '0' COMMENT '對應回供應方產品主檔的 ID',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `SNote` text DEFAULT NULL COMMENT 'Secret Note, 供正本使用',
  `Notes` text DEFAULT NULL COMMENT 'Records important remarks or considerations for both buyer and seller during the transaction',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`,`QuotationID`),
  INDEX `Idx_QUO_Product` (`TenantID`, `QuotationID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單產品主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Product_Traceability`;
CREATE TABLE  `patiscog4sys`.`QUO_Product_Traceability` (
  `ID` bigint(20) unsigned NOT NULL,
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單產品主檔的 ID',
  `Source` tinyint(1) unsigned NOT NULL COMMENT '來源代號',
  `SourceProductID` bigint(20) unsigned NOT NULL COMMENT '來源產品唯一的 ID',
  `SourceID` bigint(20) unsigned DEFAULT 0 COMMENT '來源唯一的 ID',
  `SellerID` bigint(20) unsigned DEFAULT 0 COMMENT '對應回賣家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_QUO_Product_Traceability` (`ProductID`) USING BTREE,
  INDEX `Idx_QUO_Product_Traceability_2` (`ProductID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '詢報價單品項的產品履歷';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_ProductAttachment`;
CREATE TABLE  `patiscog4sys`.`QUO_ProductAttachment` (
  `ID` bigint(20) unsigned NOT NULL,
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單產品的 ID',
  `Name` varchar(50) NOT NULL,
  `Extension` varchar(7) NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`,`TenantID`,`QuotationID`,`ProductID`),
  UNIQUE KEY `Index_UNIQUE_QUO_ProductAttachment` (`TenantID`,`QuotationID`,`ProductID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '詢報價單產品附加檔';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_ProductPriceCategory`;
CREATE TABLE  `patiscog4sys`.`QUO_ProductPriceCategory` (
  `ID` bigint(20) unsigned NOT NULL,
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單產品的 ID',
  `MOQ` int(10) unsigned NOT NULL COMMENT 'Minimum Order Quantity',
  `Price` decimal(11,4) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_QUO_ProductPriceCategory` (`TenantID`,`QuotationID`,`ProductID`) USING BTREE,
  UNIQUE KEY `Index_UNIQUE_QUO_ProductPriceCategory` (`QuotationID`,`ProductID`,`MOQ`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單產品價格分類';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Quote`;
CREATE TABLE  `patiscog4sys`.`QUO_Quote` (
  `ID` bigint(20) unsigned NOT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `Port` varchar(50) DEFAULT NULL,
  `ExpiredDate` date DEFAULT NULL,
  `No` varchar(40) DEFAULT NULL,
  `TermAndCondition` text DEFAULT NULL,
  `Status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 (預設) = 編輯中, 1 - 已確認, 2 = 已封存',
  `Type` tinyint(1) unsigned DEFAULT 1 COMMENT '種類 - 1 = 報價單, 2 = 詢價單',
  `IsNeedSync` tinyint(1) unsigned DEFAULT '0' COMMENT '是否有同步資料, 0 - false, 1 - true',
  `IsSeenByOtherSite` tinyint(1) unsigned DEFAULT '0' COMMENT '對方是否已同步資料, 0 - false, 1 - true',
  `DiscussLink` bigint(20) unsigned DEFAULT '0',
  `SnapshotID` bigint(20) unsigned DEFAULT '0',
  `ModifiedBy` bigint(20) unsigned DEFAULT '0',
  `LastModifiedDate` datetime DEFAULT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX INDEX `Idx_QUO_Quote` (`TenantID`, `Status`, `Type`) USING BTREE,
  INDEX INDEX `Idx_QUO_Quote_2` (`TenantID`, `Status`, `Type`, `CreatedBy`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Seller`;
CREATE TABLE  `patiscog4sys`.`QUO_Seller` (
  `ID` bigint(20) unsigned NOT NULL,
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單主檔的 ID',
  `Name` varchar(150) NOT NULL DEFAULT '',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單賣家資訊';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Seller_Mapping`;
CREATE TABLE  `patiscog4sys`.`QUO_Seller_Mapping` (
  `QuotationID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單主檔的 ID',
  `SellerID` bigint(20) unsigned NOT NULL COMMENT '對應回賣家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL,
  UNIQUE KEY `Index_UNIQUE_QUO_Seller_Mapping` (`QuotationID`,`SellerID`),
  INDEX `Idx_QUO_Seller_Mapping` (`TenantID`, `QuotationID`) USING BTREE,
  INDEX `Idx_QUO_Seller_Mapping_2` (`TenantID`,`SellerID`, `QuotationID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單與賣家主檔的對映表';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Snapshot_Copy_Buyer`;
CREATE TABLE  `patiscog4sys`.`QUO_Snapshot_Copy_Buyer` (
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(150) NOT NULL DEFAULT '',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_QUO_Snapshot_Copy_Buyer` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '詢報價單影本買家資訊 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Snapshot_Copy_Product`;
CREATE TABLE  `patiscog4sys`.`QUO_Snapshot_Copy_Product` (
  `ID` bigint(20) unsigned NOT NULL,
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(100) DEFAULT NULL,
  `SKU` varchar(100) DEFAULT NULL,
  `ModelNo` varchar(100) DEFAULT NULL,
  `Specification` text DEFAULT NULL,
  `Note` text DEFAULT NULL,
  `SizeUnit` tinyint(3) unsigned DEFAULT NULL,
  `Length` double(8,4) unsigned DEFAULT NULL,
  `Height` double(8,4) unsigned DEFAULT NULL,
  `Width` double(8,4) unsigned DEFAULT NULL,
  `TotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 公制',
  `ImperialTotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 英制',
  `WeightUnit` tinyint(3) unsigned DEFAULT NULL,
  `NetWeight` double(8,4) unsigned DEFAULT NULL,
  `GrossWeight` double(8,4) unsigned DEFAULT NULL,
  `UnitPerCarton` int(10) unsigned DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `Unit` varchar(50) DEFAULT NULL,
  `MOQ` int(10) unsigned DEFAULT NULL,
  `Price` decimal(11,4) DEFAULT NULL,
  `Quantity` int(10) unsigned DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `Notes` text DEFAULT NULL COMMENT 'Records important remarks or considerations for both buyer and seller during the transaction',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_QUO_Snapshot_Copy_Product` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '詢報價單影本產品主檔 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Snapshot_Copy_ProductPriceCategory`;
CREATE TABLE  `patiscog4sys`.`QUO_Snapshot_Copy_ProductPriceCategory` (
  `ID` bigint(20) unsigned NOT NULL,
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單產品的 ID',
  `MOQ` int(10) unsigned NOT NULL COMMENT 'Minimum Order Quantity',
  `Price` decimal(11,4) DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_QUO_Snapshot_Copy_ProductPriceCategory` (`TenantID`,`SnapshotID`,`ProductID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單影本產品價格分類 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Snapshot_Copy_Quote`;
CREATE TABLE  `patiscog4sys`.`QUO_Snapshot_Copy_Quote` (
  `ID` bigint(20) unsigned NOT NULL,
  `QuoteID` bigint(20) unsigned NOT NULL COMMENT '原資料來源的 Quote ID',
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `Port` varchar(50) DEFAULT NULL,
  `ExpiredDate` date DEFAULT NULL,
  `No` varchar(40) DEFAULT NULL,
  `TermAndCondition` text DEFAULT NULL,
  `Status` tinyint(1) NOT NULL DEFAULT 0,
  `Type` tinyint(1) unsigned DEFAULT 1,
  `ModifiedBy` varchar(50) DEFAULT NULL,
  `LastModifiedDate` datetime DEFAULT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_QUO_Snapshot_Copy_Quote` (`ID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '詢報價單影本主檔 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Snapshot_Copy_Seller`;
CREATE TABLE  `patiscog4sys`.`QUO_Snapshot_Copy_Seller` (
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(150) NOT NULL DEFAULT '',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_QUO_Snapshot_Copy_Seller` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '詢報價單影本賣家資訊 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Snapshot_Buyer`;
CREATE TABLE  `patiscog4sys`.`QUO_Snapshot_Buyer` (
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(150) NOT NULL DEFAULT '',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  INDEX `Idx_QUO_Snapshot_Buyer` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '詢報價單買家資訊 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Snapshot_Product`;
CREATE TABLE  `patiscog4sys`.`QUO_Snapshot_Product` (
  `ID` bigint(20) unsigned NOT NULL,
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(100) DEFAULT NULL,
  `SKU` varchar(100) DEFAULT NULL,
  `ModelNo` varchar(100) DEFAULT NULL,
  `Specification` text DEFAULT NULL,
  `Note` text DEFAULT NULL,
  `SizeUnit` tinyint(3) unsigned DEFAULT NULL,
  `Length` double(8,4) unsigned DEFAULT NULL,
  `Height` double(8,4) unsigned DEFAULT NULL,
  `Width` double(8,4) unsigned DEFAULT NULL,
  `TotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 公制',
  `ImperialTotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 英制',
  `WeightUnit` tinyint(3) unsigned DEFAULT NULL,
  `NetWeight` double(8,4) unsigned DEFAULT NULL,
  `GrossWeight` double(8,4) unsigned DEFAULT NULL,
  `UnitPerCarton` int(10) unsigned DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `Unit` varchar(50) DEFAULT NULL,
  `MOQ` int(10) unsigned DEFAULT NULL,
  `Price` decimal(11,4) DEFAULT NULL,
  `Quantity` int(10) unsigned DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `Notes` text DEFAULT NULL COMMENT 'Records important remarks or considerations for both buyer and seller during the transaction',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_QUO_Snapshot_Product` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '詢報價單產品主檔 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Snapshot_ProductPriceCategory`;
CREATE TABLE  `patiscog4sys`.`QUO_Snapshot_ProductPriceCategory` (
  `ID` bigint(20) unsigned NOT NULL,
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單產品的 ID',
  `MOQ` int(10) unsigned NOT NULL COMMENT 'Minimum Order Quantity',
  `Price` decimal(11,4) DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_QUO_Snapshot_ProductPriceCategory` (`TenantID`,`SnapshotID`,`ProductID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '報價單產品價格分類 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Snapshot_Quote`;
CREATE TABLE  `patiscog4sys`.`QUO_Snapshot_Quote` (
  `ID` bigint(20) unsigned NOT NULL,
  `QuoteID` bigint(20) unsigned NOT NULL COMMENT '原資料來源的 Quote ID',
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `Port` varchar(50) DEFAULT NULL,
  `ExpiredDate` date DEFAULT NULL,
  `No` varchar(40) DEFAULT NULL,
  `TermAndCondition` text DEFAULT NULL,
  `Status` tinyint(1) NOT NULL DEFAULT 0,
  `Type` tinyint(1) unsigned DEFAULT 1,
  `ModifiedBy` varchar(50) DEFAULT NULL,
  `LastModifiedDate` datetime DEFAULT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_QUO_Snapshot_Quote` (`ID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '詢報價單主檔 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`QUO_Snapshot_Seller`;
CREATE TABLE  `patiscog4sys`.`QUO_Snapshot_Seller` (
  `SnapshotID` bigint(20) unsigned NOT NULL COMMENT '對應回詢報價單影本主檔 - 快照用的 ID 或 品項來源用快照資料唯一 ID',
  `Name` varchar(150) NOT NULL DEFAULT '',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `IsSavedPermanently` tinyint(1) unsigned DEFAULT '0' COMMENT '是否為永久儲存, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  INDEX `Idx_QUO_Snapshot_Seller` (`SnapshotID`,`TenantID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '詢報價單賣家資訊 - 快照用';

DROP TABLE IF EXISTS `patiscog4sys`.`SE_InvitationLog`;
CREATE TABLE  `patiscog4sys`.`SE_InvitationLog` (
  `InvitationID` bigint(20) unsigned NOT NULL COMMENT '對應回邀請活動主檔的 ID',
  `SellerID` bigint(20) unsigned NOT NULL COMMENT '對應回賣家主檔的 ID',
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回公司主檔的 ID',
  PRIMARY KEY (`InvitationID`,`TenantID`) USING BTREE,
  INDEX `Idx_SE_InvitationLog` (`TenantID`,`SellerID`) USING BTREE,
  INDEX `Idx_SE_InvitationLog2` (`InvitationID`,`TenantID`,`SellerID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '賣家被邀請記錄檔';

DROP TABLE IF EXISTS `patiscog4sys`.`SE_Seller`;
CREATE TABLE  `patiscog4sys`.`SE_Seller` (
  `ID` bigint(20) unsigned NOT NULL,
  `Name` varchar(50) NOT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `ContactPerson` varchar(50) DEFAULT NULL,
  `Note` text DEFAULT NULL,
  `CompanyNumber` varchar(15) DEFAULT NULL,
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_SE_Seller` (`TenantID`,`CreatedDate`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '賣家主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_Copy_ExchangeRate`;
CREATE TABLE  `patiscog4sys`.`SHI_Copy_ExchangeRate` (
  `ID` bigint(20) unsigned NOT NULL,
  `DeliveryOrderID` bigint(20) unsigned NOT NULL COMMENT '對應回出貨單主檔的 ID',
  `RoundingType` tinyint(1) unsigned NOT NULL COMMENT '1: 是否四捨五入; 2: 是否無條件捨去; 3:是否無條件進位',
  `AccurateTo` tinyint(1) unsigned NOT NULL COMMENT '精準度',
  `Value` decimal(11,4) DEFAULT NULL COMMENT '數值',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '出貨單影本_匯率對照';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_Buyer`;
CREATE TABLE  `patiscog4sys`.`SHI_Buyer` (
  `ID` bigint(20) unsigned NOT NULL,
  `DeliveryOrderID` bigint(20) unsigned NOT NULL COMMENT '對應回出貨單主檔的 ID',
  `BuyerID` bigint(20) unsigned NOT NULL COMMENT '對應回買家主檔的 ID',
  `Name` varchar(50) NOT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `TaxID` varchar(15) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '出貨單_買家';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_DeliveryOrder`;
CREATE TABLE  `patiscog4sys`.`SHI_DeliveryOrder` (
  `ID` bigint(20) unsigned NOT NULL,
  `No` text DEFAULT NULL COMMENT '出貨單號',
  `ExpiredDate` date DEFAULT NULL COMMENT '預期出貨日 ( ETD )',
  `CreatedDate4Editable` date DEFAULT NULL COMMENT '建立日期，供前端編輯用',
  `ShippedBy` varchar(50) DEFAULT NULL COMMENT '賣家名稱',
  `ShipDate` date DEFAULT NULL COMMENT '出航日',
  `ShipNo` varchar(50) DEFAULT NULL COMMENT '船號',
  `From` varchar(20) DEFAULT NULL COMMENT '出航地',
  `To` varchar(20) DEFAULT NULL COMMENT '運抵地',
  `Shipment` text DEFAULT NULL COMMENT '運送資訊',
  `Marks` text DEFAULT NULL COMMENT '嘜頭',
  `Note` text DEFAULT NULL COMMENT '備註',
  `TermAndCondition` text DEFAULT NULL,
  `TradingCode` tinyint(3) unsigned DEFAULT NULL,
  `Port` varchar(50) DEFAULT NULL,
  `CurrencyCode` smallint(5) unsigned DEFAULT NULL,
  `CopyFrom` bigint(20) unsigned DEFAULT NULL COMMENT '拷貝自某一份 Commercial Invoice',
  `IsICodeFrontDisplay` tinyint(1) NOT NULL DEFAULT 0 COMMENT '識別碼是否顯示在前頭, 0 - false (預設), 1 - true',
  `Status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 (預設) = 編輯中, 1 = 已完成',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `CompletedDate` datetime DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_SHI_DeliveryOrder` (`TenantID`,`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '出貨單主檔';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_ExchangeRate`;
CREATE TABLE  `patiscog4sys`.`SHI_ExchangeRate` (
  `ID` bigint(20) unsigned NOT NULL,
  `DeliveryOrderID` bigint(20) unsigned NOT NULL COMMENT '對應回出貨單主檔的 ID',
  `RoundingType` tinyint(1) unsigned NOT NULL COMMENT '1: 是否四捨五入; 2: 是否無條件捨去; 3:是否無條件進位',
  `AccurateTo` tinyint(1) unsigned NOT NULL COMMENT '精準度',
  `Value` decimal(11,4) DEFAULT NULL COMMENT '數值',
  `ToCurrency` smallint(5) NOT NULL COMMENT '轉換後顯示的幣別',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '出貨單_匯率對照';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_ExtraCharge`;
CREATE TABLE  `patiscog4sys`.`SHI_ExtraCharge` (
  `ID` bigint(20) unsigned NOT NULL,
  `DeliveryOrderID` bigint(20) unsigned NOT NULL COMMENT '對應回出貨單主檔的 ID',
  `SourceOrderID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回訂單主檔的 ID',
  `Name` varchar(50) NOT NULL,
  `Type` tinyint(3) unsigned NOT NULL,
  `Amount` decimal(11,4) NOT NULL,
  `PriceAdjustmantID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回出貨單_訂單(PI)總價調整檔的 ID',
  `IsBeSeen` tinyint(1) DEFAULT 1 COMMENT '是否要輸出到報表中, 0 - false, 1 - true',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '出貨單_另增收費';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_PIOrder`;
CREATE TABLE  `patiscog4sys`.`SHI_PIOrder` (
  `ID` bigint(20) unsigned NOT NULL,
  `DeliveryOrderID` bigint(20) unsigned NOT NULL COMMENT '對應回出貨單主檔的 ID',
  `SourceOrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `No` varchar(40) DEFAULT NULL COMMENT '訂單編號',
  `ExpiredDate` date DEFAULT NULL COMMENT '預期出貨日 ( ETD )',
  `Seq` int(3) unsigned DEFAULT NULL,
  `Rank` VARCHAR(255) COLLATE utf8_bin DEFAULT NULL COMMENT '二進位排序規則用',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_SHI_PIOrder` (`TenantID`, `DeliveryOrderID`, `SourceOrderID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '出貨單_PI訂單資訊';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_PackingItem`;
CREATE TABLE  `patiscog4sys`.`SHI_PackingItem` (
  `ID` bigint(20) unsigned NOT NULL,
  `DeliveryOrderID` bigint(20) unsigned NOT NULL COMMENT '對應回出貨單主檔的 ID',
  `SourceOrderID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回訂單主檔的 ID',
  `SourceProductID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回訂單產品資訊檔的 ID',
  `SourceAppendTo` bigint(20) unsigned DEFAULT NULL COMMENT '原訂單產品顯示順序檔的 AppendTo,可對應回訂單產品資訊檔的 ID',
  `SourceSKU` varchar(100) DEFAULT NULL COMMENT '原訂單產品資訊檔的 SKU',
  `ShippingPrice` decimal(11,4) DEFAULT NULL COMMENT '出貨價格',
  `ShippingPriceOfCopy` decimal(11,4) DEFAULT NULL COMMENT '出貨單影本_出貨價格',
  `ShippingQuantity` int(10) unsigned NOT NULL COMMENT '出貨數量',
  `ShippingUnitPerCarton` int(10) unsigned DEFAULT NULL COMMENT '單位/箱',
  `WeightUnit` tinyint(3) unsigned DEFAULT NULL,
  `NetWeight` double(8,4) unsigned DEFAULT NULL,
  `GrossWeight` double(8,4) unsigned DEFAULT NULL,
  `SizeUnit` tinyint(3) unsigned DEFAULT NULL,
  `Length` double(8,4) unsigned DEFAULT NULL,
  `Height` double(8,4) unsigned DEFAULT NULL,
  `Width` double(8,4) unsigned DEFAULT NULL,
  `TotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 公制',
  `ImperialTotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '總材積 - 英制',
  `Specification` text DEFAULT NULL,
  `Type` tinyint(1) unsigned DEFAULT 0 COMMENT '種類, 0 - 新增時預設的一般箱, 1 - 新增時預設的尾箱, 2 - 自行新增',
  `AppendTo` bigint(20) unsigned DEFAULT NULL COMMENT '在某一個一般箱後(自行新增、自動拆尾箱及手動拆單時)',
  `IsBeDispensed` tinyint(1) DEFAULT 0 COMMENT '是否為 手動拆箱, 0 - false, 1 - true',
  `IsBeAnnexed` tinyint(1) DEFAULT 0 COMMENT '是否為 手動合併, 0 - false, 1 - true',
  `CreatedDate` datetime DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_SHI_PackingItem` (`TenantID`, `ID`, `DeliveryOrderID`) USING BTREE,
  INDEX `Idx_SHI_PackingItem_2` (`TenantID`, `DeliveryOrderID`, `SourceOrderID`, `SourceProductID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '出貨單_品項';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_PackingItemCaseNumber`;
CREATE TABLE  `patiscog4sys`.`SHI_PackingItemCaseNumber` (
  `ID` bigint(20) unsigned NOT NULL,
  `DeliveryOrderID` bigint(20) unsigned NOT NULL COMMENT '對應回出貨單主檔的 ID',
  `PackingItemID` bigint(20) unsigned NOT NULL COMMENT '對應回出貨單_品項檔的 ID',
  `CaseNo1` int(3) unsigned DEFAULT NULL COMMENT '箱號 - 1',
  `CaseNo2` int(3) unsigned DEFAULT NULL COMMENT '箱號 - 2',
  `IdentificationCode` varchar(2) DEFAULT NULL COMMENT '識別碼',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '出貨單_品項箱號';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_PackingItemOrderFieldType`;
CREATE TABLE  `patiscog4sys`.`SHI_PackingItemOrderFieldType` (
  `ID` bigint(20) unsigned NOT NULL,
  `DeliveryOrderID` bigint(20) unsigned NOT NULL COMMENT '對應回出貨單主檔的 ID',
  `Type` tinyint(1) unsigned DEFAULT NULL COMMENT '種類',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_SHI_PackingItemOrderFieldType` (`TenantID`, `DeliveryOrderID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '出貨單_品項排序設定';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_PriceAdjustmant`;
CREATE TABLE  `patiscog4sys`.`SHI_PriceAdjustmant` (
  `ID` bigint(20) unsigned NOT NULL,
  `DeliveryOrderID` bigint(20) unsigned NOT NULL COMMENT '對應回出貨單主檔的 ID',
  `SourceOrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `Type` tinyint(1) unsigned DEFAULT NULL COMMENT '種類',
  `ValueOfCondition` varchar(10) DEFAULT NULL COMMENT '限制條件之值',
  `Operator` tinyint(1) unsigned DEFAULT NULL COMMENT '運算子',
  `Value` decimal(11,4) DEFAULT NULL COMMENT '數值',
  `TypeOfCalculation` tinyint(1) unsigned DEFAULT NULL COMMENT '運算種類',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '出貨單_訂單(PI)總價調整';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_SameCasePhysical`;
CREATE TABLE `patiscog4sys`.`SHI_SameCasePhysical` (
  `ID` bigint(20) unsigned NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  `DeliveryOrderID` bigint(20) unsigned NOT NULL COMMENT '對應出貨單主檔 ID',
  `SourceOrderID` bigint(20) unsigned NOT NULL COMMENT '對應來源訂單 ID',
  `CaseNoStart` int(10) unsigned DEFAULT NULL COMMENT '正規化後箱號起始值；原 CaseNo1',
  `CaseNoEnd` int(10) unsigned DEFAULT NULL COMMENT '正規化後箱號結束值；原 CaseNo2',
  `IdentificationCode` varchar(2) DEFAULT NULL COMMENT '共用識別碼；需與 SHI_PackingItemCaseNumber 對齊',
  `RepresentativePackingItemID` bigint(20) unsigned DEFAULT NULL COMMENT '目前代表顯示品項 ID',
  `WeightUnit` tinyint(3) unsigned DEFAULT NULL COMMENT '同箱共用重量單位',
  `NetWeight` double(8,4) unsigned DEFAULT NULL COMMENT '同箱共用淨重；對齊 SHI_PackingItem.NetWeight',
  `GrossWeight` double(8,4) unsigned DEFAULT NULL COMMENT '同箱共用毛重；對齊 SHI_PackingItem.GrossWeight',
  `SizeUnit` tinyint(3) unsigned DEFAULT NULL COMMENT '同箱共用尺寸單位',
  `Length` double(8,4) unsigned DEFAULT NULL COMMENT '同箱共用箱長；對齊 SHI_PackingItem.Length',
  `Height` double(8,4) unsigned DEFAULT NULL COMMENT '同箱共用箱高；對齊 SHI_PackingItem.Height',
  `Width` double(8,4) unsigned DEFAULT NULL COMMENT '同箱共用箱寬；對齊 SHI_PackingItem.Width',
  `TotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '同箱共用材積 - 公制；對齊 SHI_PackingItem.TotalDimension',
  `ImperialTotalDimension` double(12,4) unsigned DEFAULT NULL COMMENT '同箱共用材積 - 英制；對齊 SHI_PackingItem.ImperialTotalDimension',
  `SortOrder` int(10) unsigned DEFAULT NULL COMMENT '同箱群組顯示排序',
  `CreatedDate` datetime DEFAULT NULL,
  `UpdatedDate` datetime DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Uk_SHI_SameCasePhysical`
    (`TenantID`, `DeliveryOrderID`, `SourceOrderID`, `CaseNoStart`, `CaseNoEnd`, `IdentificationCode`),
  KEY `Idx_SHI_SameCasePhysical_1` (`TenantID`, `DeliveryOrderID`),
  KEY `Idx_SHI_SameCasePhysical_2`
    (`TenantID`, `DeliveryOrderID`, `SourceOrderID`, `CaseNoStart`, `CaseNoEnd`),
  KEY `Idx_SHI_SameCasePhysical_3` (`TenantID`, `RepresentativePackingItemID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='出貨單_同箱號共用物理資料';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_SameCasePhysicalItem`;
CREATE TABLE `patiscog4sys`.`SHI_SameCasePhysicalItem` (
  `ID` bigint(20) unsigned NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  `SameCasePhysicalID` bigint(20) unsigned NOT NULL COMMENT '對應 SHI_SameCasePhysical.ID',
  `PackingItemID` bigint(20) unsigned NOT NULL COMMENT '對應 SHI_PackingItem.ID',
  `PackedQuantity` decimal(18,4) NOT NULL DEFAULT 0.0000 COMMENT '該品項在此同箱資料中的裝箱數量',
  `AllocatedNetWeight` double(12,4) unsigned DEFAULT NULL COMMENT '該品項分攤淨重',
  `AllocatedGrossWeight` double(12,4) unsigned DEFAULT NULL COMMENT '該品項分攤毛重',
  `Remark` varchar(255) DEFAULT NULL COMMENT '同箱資料補充說明',
  `CreatedDate` datetime DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Uk_SHI_SameCasePhysicalItem_1`
    (`TenantID`, `SameCasePhysicalID`, `PackingItemID`),
  UNIQUE KEY `Uk_SHI_SameCasePhysicalItem_2`
    (`TenantID`, `PackingItemID`),
  KEY `Idx_SHI_SameCasePhysicalItem_1` (`TenantID`, `SameCasePhysicalID`),
  KEY `Idx_SHI_SameCasePhysicalItem_2` (`TenantID`, `PackingItemID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='出貨單_同箱號共用物理資料_品項對應';

DROP TABLE IF EXISTS `patiscog4sys`.`SHI_ShippingInfo`;
CREATE TABLE  `patiscog4sys`.`SHI_ShippingInfo` (
  `ID` bigint(20) unsigned NOT NULL,
  `DeliveryOrderID` bigint(20) unsigned NOT NULL COMMENT '對應回出貨單主檔的 ID',
  `ShipVia` varchar(20) DEFAULT NULL COMMENT '運送方式',
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(40) DEFAULT NULL,
  `CountryCode` varchar(2) DEFAULT NULL,
  `PostalCode` varchar(10) DEFAULT NULL,
  `PhoneNo` varchar(30) DEFAULT NULL,
  `FAX` varchar(30) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `ShipTo` varchar(40) DEFAULT NULL COMMENT '收件公司',
  `Receiver` varchar(50) DEFAULT NULL COMMENT '收件人',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '出貨單_買家運送地址資訊';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_CatalogBrowsingHistory`;
CREATE TABLE  `patiscog4sys`.`SYS_CatalogBrowsingHistory` (
  `ID` bigint(20) unsigned NOT NULL,
  `BuyerType` ENUM('BUYER', 'GUEST') NOT NULL COMMENT '買家類型',
  `BuyerID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回買家主檔的 ID',
  `GuestID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回公開買家主檔的 ID',
  `ActionType` varchar(30) DEFAULT NULL COMMENT '行為類型',
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '對應回型錄主檔的 ID',
  `ProductID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回該型錄中所對應的產品檔的 ID',
  `IPAddress` VARCHAR(45) NULL COMMENT 'Client IP (IPv4/IPv6)',
  `DeviceType` VARCHAR(45) NULL COMMENT 'Desktop/Mobile/Tablet',
  `Browser` VARCHAR(50) NULL COMMENT 'Browser name',
  `BrowserVersion` VARCHAR(30) NULL COMMENT 'Browser version',
  `OS` VARCHAR(50) NULL COMMENT 'Operating system',
  `UserAgent` VARCHAR(512) NULL COMMENT 'Raw User-Agent header',
  `CreatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '事件發生時間',
  `EventDate` DATE NOT NULL COMMENT '事件日期',
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  INDEX `Idx_SYS_CatalogBrowsingHistory_1` (`TenantID`, `EventDate`) USING BTREE,
  INDEX `Idx_SYS_CatalogBrowsingHistory_2` (`BuyerID`, `EventDate`) USING BTREE,
  INDEX `Idx_SYS_CatalogBrowsingHistory_3` (`GuestID`, `EventDate`) USING BTREE,
  INDEX `Idx_SYS_CatalogBrowsingHistory_4` (`EventDate`, `ID`) USING BTREE,
  INDEX `Idx_SYS_CatalogBrowsingHistory_5` (`TenantID`, `EventDate`, `ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '收集使用者在型錄的行為用';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_CartActionEvent`;
CREATE TABLE  `patiscog4sys`.`SYS_CartActionEvent` (
  `ID` bigint(20) unsigned NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回租戶主檔的 ID',
  `BuyerType` ENUM('BUYER', 'GUEST') NOT NULL COMMENT '買家類型',
  `BuyerID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回買家主檔的 ID',
  `GuestID` bigint(20) unsigned DEFAULT NULL COMMENT '對應回公開買家主檔的 ID',
  `ActionType` varchar(30) NOT NULL COMMENT 'ADD_TO_CART/PLACE_ORDER/PLACE_INQUIRY/RESELL',
  `CartID` bigint(20) unsigned DEFAULT NULL COMMENT '對應購物車主檔的 ID (如有)',
  `OrderID` bigint(20) unsigned DEFAULT NULL COMMENT '對應訂單主檔的 ID (如有)',
  `InquiryID` bigint(20) unsigned DEFAULT NULL COMMENT '對應詢報價單主檔的 ID (如有)',
  `CreatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '事件發生時間',
  `EventDate` DATE NOT NULL COMMENT '事件日期',
  PRIMARY KEY (`ID`),
  INDEX `Idx_SYS_CartActionEvent_1` (`TenantID`, `EventDate`) USING BTREE,
  INDEX `Idx_SYS_CartActionEvent_2` (`BuyerID`, `EventDate`) USING BTREE,
  INDEX `Idx_SYS_CartActionEvent_3` (`GuestID`, `EventDate`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '購物車相關使用者行為事件';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_CartActionItem`;
CREATE TABLE  `patiscog4sys`.`SYS_CartActionItem` (
  `ID` bigint(20) unsigned NOT NULL,
  `EventID` bigint(20) unsigned NOT NULL COMMENT '對應回購物車行為事件的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '商品 ID',
  `Quantity` int(10) unsigned DEFAULT NULL COMMENT '商品數量; reSell 可為 NULL 或 1',
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '租戶 ID',
  `CreatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
  PRIMARY KEY (`ID`),
  INDEX `Idx_SYS_CartActionItem_1` (`EventID`) USING BTREE,
  INDEX `Idx_SYS_CartActionItem_2` (`TenantID`, `ProductID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '購物車相關行為的商品明細';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_CleanSnapshot_Order`;
CREATE TABLE  `patiscog4sys`.`SYS_CleanSnapshot_Order` (
  `SnapshotID` bigint(20) unsigned NOT NULL,
  `Type` tinyint(1) unsigned NOT NULL COMMENT '種類 - 1 = 正本, 2 = 副本',
  `TenantID` bigint(20) unsigned NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '系統_清除訂單快照清單';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_CleanSnapshot_Quote`;
CREATE TABLE  `patiscog4sys`.`SYS_CleanSnapshot_Quote` (
  `SnapshotID` bigint(20) unsigned NOT NULL,
  `Type` tinyint(1) unsigned NOT NULL COMMENT '種類 - 1 = 正本, 2 = 副本',
  `TenantID` bigint(20) unsigned NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '系統_清除詢報價單快照清單';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_ExecTranslationResult`;
CREATE TABLE  `patiscog4sys`.`SYS_ExecTranslationResult` (
  `ActivityID` bigint(20) unsigned NOT NULL COMMENT '對應回語系翻譯活動紀錄主檔的 ID',
  `CategoryCount` int(10) unsigned DEFAULT 0,
  `ProductCount` int(10) unsigned DEFAULT 0,
  `CreatedDate` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '語系翻譯執行結果紀錄';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_Export_CheckPoint`;
CREATE TABLE  `patiscog4sys`.`SYS_Export_CheckPoint` (
  `ID` bigint(20) unsigned NOT NULL,
  `TableName` varchar(50) NOT NULL COMMENT '對應的資料表名稱',
  `LastExportedID` BIGINT(20) UNSIGNED DEFAULT NULL COMMENT '最後成功導出的 ID 切點（備用）',
  `ExportStatus` ENUM('SUCCESS', 'FAILED', 'IN_PROGRESS') NOT NULL DEFAULT 'SUCCESS',
  `CreatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `LastExportedDay` DATE DEFAULT NULL COMMENT 'Last exported day for catch-up logic',
  `TenantID` bigint(20) unsigned DEFAULT NULL COMMENT 'Tenant ID for per-tenant tracking',
  `UpdatedAt` TIMESTAMP NULL DEFAULT NULL COMMENT 'Last update timestamp',
  PRIMARY KEY (`ID`),
  UNIQUE KEY Index_SYS_Export_CheckPoint (TableName, TenantID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '收集使用者行為用 - 切點管理表';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_ResetUserInfoNumberingMachine`;
CREATE TABLE  `patiscog4sys`.`SYS_ResetUserInfoNumberingMachine` (
  `ID` varchar(36) NOT NULL,
  `UserID` bigint(20) unsigned NOT NULL COMMENT '設定對象的使用者 ID, 對應回公司員工主檔的 ID, 若為 0 者代表是設定公司主檔用 EMail(1)',
  `Target` tinyint(1) unsigned NOT NULL COMMENT '設定對象, 1 - BS_Company 公司主檔用 EMail, 2 - BS_CompanyUser 公司員工主檔用 LoginID, 3 - BS_CompanyUser 公司員工主檔用 Password, 4 - BS_CompanyUser 公司員工主檔用 EMail',
  `IsUsed` tinyint(1) unsigned DEFAULT 0 COMMENT '是否已取用, 0 - false, 1 - true',
  `IsValid` tinyint(1) DEFAULT 1 COMMENT '0 = 失效, 1 (預設) = 有效',
  `Is2FA` tinyint(1) DEFAULT 0 COMMENT '是否為 2FA, 0 - false, 1 - true',
  `Value` varchar(40) NOT NULL COMMENT '新設定值',
  `CreatedBy` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL COMMENT '對應回公司主檔的 ID',
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '重設 UserInfo 用號碼機';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_Statistic`;
CREATE TABLE  `patiscog4sys`.`SYS_Statistic` (
  `ID` bigint(20) unsigned NOT NULL,
  `Size` double(20,4) unsigned NOT NULL,
  `LastModifiedDate` datetime DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '系統_使用統計';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_TranslationActivity`;
CREATE TABLE  `patiscog4sys`.`SYS_TranslationActivity` (
  `ID` bigint(20) unsigned NOT NULL,
  `LanguageID` bigint(20) unsigned NOT NULL COMMENT '對應回系統多語系設定主檔的 ID',
  `TenantIdOfRequest` bigint(20) unsigned NOT NULL COMMENT '對應回公司主檔的 ID',
  `UserIdOfRequest` bigint(20) unsigned NOT NULL COMMENT '對應回公司員工主檔的 ID',
  `IsHasBeenExecuted` tinyint(1) unsigned DEFAULT '0' COMMENT '是否已執行, 0 - false, 1 - true',
  `IsHasBeenAssign` tinyint(1) unsigned DEFAULT '0' COMMENT '是否已指配處理, 0 - false, 1 - true',
  `RequestedDate` datetime NOT NULL COMMENT '使用者請求日期時間',
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '語系翻譯活動紀錄';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_TranslationStatisticalAnalysis`;
CREATE TABLE  `patiscog4sys`.`SYS_TranslationStatisticalAnalysis` (
  `TenantIdOfRequest` bigint(20) unsigned NOT NULL COMMENT '對應回公司主檔的 ID',
  `LanguageID` bigint(20) unsigned NOT NULL COMMENT '對應回系統多語系設定主檔的 ID',
  `CategoryCount` int(10) unsigned DEFAULT 0,
  `ProductCount` int(10) unsigned DEFAULT 0,
  `UnitCount` int(10) unsigned DEFAULT 0,
  `CreatedDate` datetime NOT NULL,
  UNIQUE KEY `Index_UNIQUE_CAT_Buyer` (`TenantIdOfRequest`,`LanguageID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '租戶語系統計紀錄';

DROP TABLE IF EXISTS `patiscog4sys`.`SYS_Web_Version`;
CREATE TABLE  `patiscog4sys`.`SYS_Web_Version` (
  `Version` varchar(8) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '系統_G4 Web 現在版本';

DROP TABLE IF EXISTS `patiscog4sys`.`TMP_ReSell_Categories`;
CREATE TABLE  `patiscog4sys`.`TMP_ReSell_Categories` (
  `JobID` bigint(20) unsigned NOT NULL,
  `CategoryID` bigint(20) unsigned NOT NULL,
  `CategoryName` varchar(50) NOT NULL NOT NULL,
  `ParentID` bigint(20) unsigned NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '暫存_轉賣賣家商品匯入標籤用';

DROP TABLE IF EXISTS `patiscog4sys`.`TMP_Sync_CAT_BillboardItem`;
CREATE TABLE  `patiscog4sys`.`TMP_Sync_CAT_BillboardItem` (
  `JobID` bigint(20) unsigned NOT NULL,
  `ItemID` bigint(20) unsigned NOT NULL COMMENT '型錄廣告看板品項主檔的 ID',
  `CatalogID` bigint(20) unsigned NOT NULL COMMENT '對應回型錄主檔的 ID',
  `PublicFileID` bigint(20) unsigned NOT NULL COMMENT '對應回公用檔案的 ID',
  `AppendTo` bigint(20) unsigned DEFAULT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '暫存_型錄廣告看板品項順序同步用';

DROP TABLE IF EXISTS `patiscog4sys`.`TMP_Sync_ORD_ProductSequence`;
CREATE TABLE  `patiscog4sys`.`TMP_Sync_ORD_ProductSequence` (
  `JobID` bigint(20) unsigned NOT NULL,
  `OrderID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單主檔的 ID',
  `ProductID` bigint(20) unsigned NOT NULL COMMENT '對應回訂單產品的 ID',
  `AppendTo` bigint(20) unsigned NOT NULL,
  `TenantID` bigint(20) unsigned NOT NULL,
  `CreatedDate` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT = '暫存_訂單品項順序同步用';
