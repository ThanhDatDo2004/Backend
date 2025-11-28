-- thuere.Shop_Request_Inbox definition

CREATE TABLE `Shop_Request_Inbox` (
`RequestID` int NOT NULL AUTO_INCREMENT,
`FullName` varchar(255) NOT NULL,
`Email` varchar(190) NOT NULL,
`PhoneNumber` varchar(30) NOT NULL,
`Address` varchar(255) NOT NULL,
`Message` text,
`Status` enum('pending','reviewed','approved','rejected') NOT NULL DEFAULT 'pending',
`CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (`RequestID`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Users_Level definition

CREATE TABLE `Users_Level` (
`LevelCode` int NOT NULL,
`LevelType` enum('cus','shop','admin') NOT NULL,
`isActive` tinyint(1) DEFAULT NULL,
`_destroy` tinyint DEFAULT NULL,
PRIMARY KEY (`LevelCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Users definition

CREATE TABLE `Users` (
`UserID` int NOT NULL AUTO_INCREMENT,
`LevelCode` int NOT NULL,
`FullName` varchar(120) NOT NULL,
`Email` varchar(190) NOT NULL,
`PasswordHash` varchar(255) NOT NULL,
`IsActive` tinyint(1) DEFAULT NULL,
`EmailVerified` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'Y',
`FirstLogin` tinyint(1) DEFAULT NULL,
`_destroy` tinyint DEFAULT NULL,
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`UserID`),
UNIQUE KEY `UK_Users_Email` (`Email`),
KEY `IDX_Users_Level` (`LevelCode`),
CONSTRAINT `FK_Users_Level` FOREIGN KEY (`LevelCode`) REFERENCES `Users_Level` (`LevelCode`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Shops definition

CREATE TABLE `Shops` (
`ShopCode` int NOT NULL AUTO_INCREMENT,
`UserID` int NOT NULL,
`ShopName` varchar(255) NOT NULL,
`Address` varchar(255) DEFAULT NULL,
`PhoneNumber` varchar(20) DEFAULT NULL,
`OpeningTime` time DEFAULT NULL,
`ClosingTime` time DEFAULT NULL,
`IsOpen24Hours` char(1) NOT NULL DEFAULT 'N',
`IsApproved` char(1) NOT NULL DEFAULT 'N',
`ApprovedAt` datetime DEFAULT NULL,
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`ShopCode`),
KEY `IDX_Shops_UserID` (`UserID`),
KEY `IDX_Shops_IsApproved` (`IsApproved`),
CONSTRAINT `FK_Shops_User` FOREIGN KEY (`UserID`) REFERENCES `Users` (`UserID`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Fields definition

CREATE TABLE `Fields` (
`FieldCode` int NOT NULL AUTO_INCREMENT,
`ShopCode` int NOT NULL,
`FieldName` varchar(255) NOT NULL,
`SportType` enum('badminton','football','baseball','swimming','tennis') NOT NULL,
`Address` varchar(255) DEFAULT NULL,
`DefaultPricePerHour` decimal(10,2) NOT NULL DEFAULT '0.00',
`Status` enum('active','maintenance','inactive') DEFAULT 'active',
`Rent` int NOT NULL DEFAULT '0',
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`FieldCode`),
KEY `FK_Fields_Shops` (`ShopCode`),
CONSTRAINT `FK_Fields_Shops` FOREIGN KEY (`ShopCode`) REFERENCES `Shops` (`ShopCode`)
) ENGINE=InnoDB AUTO_INCREMENT=73 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Shop_Bank_Accounts definition

CREATE TABLE `Shop_Bank_Accounts` (
`ShopBankID` int NOT NULL AUTO_INCREMENT,
`ShopCode` int NOT NULL,
`BankName` varchar(120) NOT NULL,
`AccountNumber` varchar(64) NOT NULL,
`AccountHolder` varchar(120) NOT NULL,
`IsDefault` char(1) DEFAULT 'N',
`IsVerified` char(1) DEFAULT 'N',
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`ShopBankID`),
KEY `FK_ShopBankAccounts_Shops` (`ShopCode`),
CONSTRAINT `FK_ShopBankAccounts_Shops` FOREIGN KEY (`ShopCode`) REFERENCES `Shops` (`ShopCode`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Shop_Promotions definition

CREATE TABLE `Shop_Promotions` (
`PromotionID` int NOT NULL AUTO_INCREMENT,
`ShopCode` int NOT NULL,
`PromotionCode` varchar(50) NOT NULL,
`Title` varchar(150) NOT NULL,
`Description` text,
`DiscountType` enum('percent','fixed') NOT NULL,
`DiscountValue` decimal(10,2) NOT NULL,
`MaxDiscountAmount` decimal(10,2) DEFAULT NULL,
`MinOrderAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
`UsageLimit` int DEFAULT NULL,
`UsagePerCustomer` int NOT NULL DEFAULT '1',
`StartAt` datetime NOT NULL,
`EndAt` datetime NOT NULL,
`Status` enum('draft','scheduled','active','expired','disabled') NOT NULL DEFAULT 'draft',
`IsDeleted` tinyint(1) NOT NULL DEFAULT '0',
`DeletedAt` datetime DEFAULT NULL,
`CreatedBy` int DEFAULT NULL,
`CreateAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`PromotionID`),
UNIQUE KEY `UQ_ShopPromotions_PromotionCode` (`PromotionCode`),
KEY `IDX_ShopPromotions_ShopCode` (`ShopCode`),
KEY `IDX_ShopPromotions_Shop_Status_EndAt` (`ShopCode`,`Status`,`EndAt`),
KEY `IDX_ShopPromotions_IsDeleted` (`IsDeleted`),
KEY `IDX_ShopPromotions_CreatedBy` (`CreatedBy`),
CONSTRAINT `FK_ShopPromotions_CreatedBy` FOREIGN KEY (`CreatedBy`) REFERENCES `Users` (`UserID`) ON DELETE SET NULL ON UPDATE CASCADE,
CONSTRAINT `FK_ShopPromotions_Shops` FOREIGN KEY (`ShopCode`) REFERENCES `Shops` (`ShopCode`) ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT `CHK_DiscountValue` CHECK ((`DiscountValue` >= 0)),
CONSTRAINT `CHK_MaxDiscount` CHECK (((`MaxDiscountAmount` is null) or (`MaxDiscountAmount` >= 0))),
CONSTRAINT `CHK_MinOrder` CHECK ((`MinOrderAmount` >= 0)),
CONSTRAINT `CHK_PercentCap` CHECK (((`DiscountType` = \_utf8mb4'fixed') or ((`DiscountType` = \_utf8mb4'percent') and (`DiscountValue` <= 100)))),
CONSTRAINT `CHK_TimeRange` CHECK ((`StartAt` < `EndAt`)),
CONSTRAINT `CHK_UsageLimit` CHECK (((`UsageLimit` is null) or (`UsageLimit` >= 0))),
CONSTRAINT `CHK_UsagePerCustomer` CHECK ((`UsagePerCustomer` >= 1))
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Shop_Utilities definition

CREATE TABLE `Shop_Utilities` (
`ShopUtilityID` int NOT NULL AUTO_INCREMENT,
`ShopCode` int NOT NULL,
`UtilityID` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
`UtilityName` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
`CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
`UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`ShopUtilityID`),
UNIQUE KEY `uniq_shop_utility` (`ShopCode`,`UtilityID`),
CONSTRAINT `FK_ShopUtilities_Shops` FOREIGN KEY (`ShopCode`) REFERENCES `Shops` (`ShopCode`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- thuere.Shop_Wallets definition

CREATE TABLE `Shop_Wallets` (
`ShopCode` int NOT NULL,
`Balance` decimal(14,2) NOT NULL DEFAULT '0.00',
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`ShopCode`),
CONSTRAINT `FK_ShopWallets_Shops` FOREIGN KEY (`ShopCode`) REFERENCES `Shops` (`ShopCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Field_Images definition

CREATE TABLE `Field_Images` (
`ImageCode` int NOT NULL AUTO_INCREMENT,
`FieldCode` int NOT NULL,
`ImageUrl` varchar(500) NOT NULL,
`SortOrder` int DEFAULT '0',
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`ImageCode`),
KEY `FK_FieldImages_Fields` (`FieldCode`),
CONSTRAINT `FK_FieldImages_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Field_Pricing definition

CREATE TABLE `Field_Pricing` (
`PricingID` int NOT NULL AUTO_INCREMENT,
`FieldCode` int NOT NULL,
`DayOfWeek` tinyint NOT NULL,
`StartTime` time NOT NULL,
`EndTime` time NOT NULL,
`PricePerHour` decimal(10,2) NOT NULL,
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`PricingID`),
KEY `FK_FieldPricing_Fields` (`FieldCode`),
CONSTRAINT `FK_FieldPricing_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`),
CONSTRAINT `CHK_FieldPricing_Time` CHECK ((`StartTime` < `EndTime`))
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Field_Quantity definition

CREATE TABLE `Field_Quantity` (
`QuantityID` int NOT NULL AUTO_INCREMENT,
`FieldCode` int NOT NULL,
`QuantityNumber` int NOT NULL,
`Status` enum('available','maintenance','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'available',
`CreatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
`UpdatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`QuantityID`),
UNIQUE KEY `UniqueFieldQuantity` (`FieldCode`,`QuantityNumber`),
KEY `IdxFieldCodeStatus` (`FieldCode`,`Status`),
CONSTRAINT `Field_Quantity_ibfk_1` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- thuere.Payout_Requests definition

CREATE TABLE `Payout_Requests` (
`PayoutID` int NOT NULL AUTO_INCREMENT,
`ShopCode` int NOT NULL,
`ShopBankID` int NOT NULL,
`Amount` decimal(14,2) NOT NULL,
`Status` enum('requested','processing','paid','rejected') DEFAULT 'requested',
`RequestedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`ProcessedAt` datetime DEFAULT NULL,
`Note` varchar(255) DEFAULT NULL,
`TransactionCode` varchar(64) DEFAULT NULL,
`RejectionReason` varchar(255) DEFAULT NULL,
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`PayoutID`),
UNIQUE KEY `TransactionCode` (`TransactionCode`),
KEY `FK_PayoutRequests_Shops` (`ShopCode`),
KEY `FK_PayoutRequests_Banks` (`ShopBankID`),
CONSTRAINT `FK_PayoutRequests_Banks` FOREIGN KEY (`ShopBankID`) REFERENCES `Shop_Bank_Accounts` (`ShopBankID`),
CONSTRAINT `FK_PayoutRequests_Shops` FOREIGN KEY (`ShopCode`) REFERENCES `Shops` (`ShopCode`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Booking_Carts definition

CREATE TABLE `Booking_Carts` (
`CartID` int NOT NULL AUTO_INCREMENT,
`UserID` int NOT NULL,
`BookingCode` int NOT NULL,
`ExpiresAt` datetime NOT NULL,
`CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`CartID`),
UNIQUE KEY `UK_BookingCarts_Booking` (`BookingCode`),
KEY `IDX_BookingCarts_User` (`UserID`,`ExpiresAt`),
CONSTRAINT `FK_BookingCarts_Bookings` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`) ON DELETE CASCADE,
CONSTRAINT `FK_BookingCarts_Users` FOREIGN KEY (`UserID`) REFERENCES `Users` (`UserID`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Booking_Slots definition

CREATE TABLE `Booking_Slots` (
`Slot_ID` int NOT NULL AUTO_INCREMENT,
`BookingCode` int NOT NULL,
`FieldCode` int NOT NULL,
`QuantityID` int DEFAULT NULL,
`PlayDate` date NOT NULL,
`StartTime` time NOT NULL,
`EndTime` time NOT NULL,
`PricePerSlot` int DEFAULT '100000',
`Status` enum('pending','booked','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
`CreateAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`Slot_ID`),
UNIQUE KEY `unique_slot_with_quantity` (`BookingCode`,`PlayDate`,`StartTime`,`QuantityID`),
KEY `idx_booking_code` (`BookingCode`),
KEY `idx_field_date` (`FieldCode`,`PlayDate`),
KEY `IDX_BookingSlots_QuantityID` (`QuantityID`),
CONSTRAINT `Booking_Slots_ibfk_1` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`) ON DELETE CASCADE,
CONSTRAINT `FK_BookingSlots_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`),
CONSTRAINT `FK_BookingSlots_QuantityID` FOREIGN KEY (`QuantityID`) REFERENCES `Field_Quantity` (`QuantityID`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=284 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- thuere.Bookings definition

CREATE TABLE `Bookings` (
`BookingCode` int NOT NULL AUTO_INCREMENT,
`FieldCode` int NOT NULL,
`CustomerUserID` int NOT NULL,
`CustomerName` varchar(120) DEFAULT NULL,
`CustomerEmail` varchar(120) DEFAULT NULL,
`CustomerPhone` varchar(30) DEFAULT NULL,
`TotalPrice` decimal(14,2) NOT NULL,
`PlatformFee` decimal(14,2) NOT NULL,
`NetToShop` decimal(14,2) NOT NULL,
`DiscountAmount` decimal(14,2) NOT NULL DEFAULT '0.00',
`BookingStatus` enum('pending','confirmed','cancelled','completed') DEFAULT 'pending',
`PaymentID` int DEFAULT NULL,
`PromotionID` int DEFAULT NULL,
`PromotionCode` varchar(50) DEFAULT NULL,
`PaymentStatus` enum('pending','paid','failed','refunded') DEFAULT 'pending',
`CheckinCode` varchar(32) DEFAULT NULL,
`CheckinTime` datetime DEFAULT NULL,
`CompletedAt` datetime DEFAULT NULL,
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
`QuantityID` int DEFAULT NULL,
PRIMARY KEY (`BookingCode`),
UNIQUE KEY `CheckinCode` (`CheckinCode`),
UNIQUE KEY `PaymentID` (`PaymentID`),
KEY `IDX_Bookings_FieldDate` (`FieldCode`),
KEY `IDX_Bookings_Status` (`BookingStatus`),
KEY `IDX_Bookings_PaymentStatus` (`PaymentStatus`),
KEY `IDX_Bookings_CustomerUserID` (`CustomerUserID`),
KEY `IdxQuantityID` (`QuantityID`),
KEY `IDX_Bookings_PromotionID` (`PromotionID`),
CONSTRAINT `Bookings_ibfk_1` FOREIGN KEY (`QuantityID`) REFERENCES `Field_Quantity` (`QuantityID`),
CONSTRAINT `FK_Bookings_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`),
CONSTRAINT `FK_Bookings_Payments` FOREIGN KEY (`PaymentID`) REFERENCES `Payments_Admin` (`PaymentID`),
CONSTRAINT `FK_Bookings_Promotions` FOREIGN KEY (`PromotionID`) REFERENCES `Shop_Promotions` (`PromotionID`),
CONSTRAINT `FK_Bookings_Users` FOREIGN KEY (`CustomerUserID`) REFERENCES `Users` (`UserID`)
) ENGINE=InnoDB AUTO_INCREMENT=242 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Field_Slots definition

CREATE TABLE `Field_Slots` (
`SlotID` int NOT NULL AUTO_INCREMENT,
`FieldCode` int NOT NULL,
`PlayDate` date NOT NULL,
`StartTime` time NOT NULL,
`EndTime` time NOT NULL,
`Status` enum('available','booked','held') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
`BookingCode` int DEFAULT NULL,
`QuantityID` int DEFAULT NULL,
`HoldExpiresAt` datetime DEFAULT NULL,
`CreatedBy` int DEFAULT NULL,
`CreateAt` timestamp NULL DEFAULT NULL,
`UpdateAt` timestamp NULL DEFAULT NULL,
PRIMARY KEY (`SlotID`),
UNIQUE KEY `uniq_field_slots_quantity` (`FieldCode`,`QuantityID`,`PlayDate`,`StartTime`,`EndTime`),
KEY `FieldCode` (`FieldCode`,`PlayDate`,`Status`),
KEY `BookingCode` (`BookingCode`),
KEY `FK_Field_Slots_Quantity` (`QuantityID`),
KEY `IDX_FieldQuantity_Date` (`FieldCode`,`QuantityID`,`PlayDate`,`StartTime`),
KEY `FK_FieldSlots_CreatedBy` (`CreatedBy`),
CONSTRAINT `Field_Slots_ibfk_1` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`) ON DELETE SET NULL,
CONSTRAINT `FK_Field_Slots_Quantity` FOREIGN KEY (`QuantityID`) REFERENCES `Field_Quantity` (`QuantityID`) ON DELETE SET NULL,
CONSTRAINT `FK_FieldSlots_CreatedBy` FOREIGN KEY (`CreatedBy`) REFERENCES `Users` (`UserID`),
CONSTRAINT `FK_FieldSlots_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`)
) ENGINE=InnoDB AUTO_INCREMENT=193 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- thuere.Payment_Logs definition

CREATE TABLE `Payment_Logs` (
`LogID` int NOT NULL AUTO_INCREMENT,
`PaymentID` int NOT NULL,
`Action` varchar(100) DEFAULT NULL,
`RequestData` json DEFAULT NULL,
`ResponseData` json DEFAULT NULL,
`MomoTransactionID` varchar(64) DEFAULT NULL,
`ResultCode` int DEFAULT NULL,
`ResultMessage` varchar(255) DEFAULT NULL,
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (`LogID`),
KEY `FK_PaymentLogs_Payments` (`PaymentID`),
CONSTRAINT `FK_PaymentLogs_Payments` FOREIGN KEY (`PaymentID`) REFERENCES `Payments_Admin` (`PaymentID`)
) ENGINE=InnoDB AUTO_INCREMENT=79 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Payments_Admin definition

CREATE TABLE `Payments_Admin` (
`PaymentID` int NOT NULL AUTO_INCREMENT,
`BookingCode` int NOT NULL,
`PaymentMethod` enum('bank_transfer','card','ewallet','cash') DEFAULT 'bank_transfer',
`Amount` decimal(14,2) NOT NULL,
`MomoTransactionID` varchar(64) DEFAULT NULL,
`PaidAt` datetime DEFAULT NULL,
`PaymentStatus` enum('pending','paid','failed','refunded') DEFAULT 'pending',
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`PaymentID`),
UNIQUE KEY `MomoTransactionID` (`MomoTransactionID`),
KEY `FK_PaymentsAdmin_Bookings` (`BookingCode`),
KEY `IDX_Payments_Status` (`PaymentStatus`),
KEY `IDX_Payments_CreateAt` (`CreateAt` DESC),
CONSTRAINT `FK_PaymentsAdmin_Bookings` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`)
) ENGINE=InnoDB AUTO_INCREMENT=205 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- thuere.Wallet_Transactions definition

CREATE TABLE `Wallet_Transactions` (
`WalletTxnID` int NOT NULL AUTO_INCREMENT,
`ShopCode` int NOT NULL,
`BookingCode` int DEFAULT NULL,
`Type` enum('credit_settlement','debit_payout','adjustment') NOT NULL,
`Amount` decimal(14,2) NOT NULL,
`Note` varchar(255) DEFAULT NULL,
`Status` enum('pending','completed','failed') DEFAULT 'completed',
`PayoutID` int DEFAULT NULL,
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (`WalletTxnID`),
KEY `FK_WalletTransactions_Bookings` (`BookingCode`),
KEY `FK_WalletTxn_Payout` (`PayoutID`),
KEY `IDX_WalletTxn_ShopCode_CreateAt` (`ShopCode`,`CreateAt` DESC),
KEY `IDX_WalletTxn_Type` (`Type`),
CONSTRAINT `FK_WalletTransactions_Bookings` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`),
CONSTRAINT `FK_WalletTransactions_Wallet` FOREIGN KEY (`ShopCode`) REFERENCES `Shop_Wallets` (`ShopCode`),
CONSTRAINT `FK_WalletTxn_Payout` FOREIGN KEY (`PayoutID`) REFERENCES `Payout_Requests` (`PayoutID`)
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
