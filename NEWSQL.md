-- =========================================================
-- Database & session
-- =========================================================
CREATE DATABASE IF NOT EXISTS `thuere`
/_!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci _/;
USE `thuere`;

-- =========================================================
-- 1) Lookup & user tables
-- =========================================================
DROP TABLE IF EXISTS `Users_Level`;
CREATE TABLE `Users_Level` (
`LevelCode` int NOT NULL,
`LevelType` enum('cus','shop','admin') NOT NULL,
`isActive` tinyint(1) DEFAULT 1,
`_destroy` tinyint DEFAULT 0,
PRIMARY KEY (`LevelCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Users` (
`UserID` int NOT NULL AUTO_INCREMENT,
`LevelCode` int NOT NULL,
`FullName` varchar(120) NOT NULL,
`Email` varchar(190) NOT NULL,
`PhoneNumber` varchar(30) DEFAULT NULL,
`PasswordHash` varchar(255) NOT NULL,
`IsActive` tinyint(1) DEFAULT NULL,
`EmailVerified` char(1) DEFAULT 'N',
`EmailVerifiedAt` datetime DEFAULT NULL,
`_destroy` tinyint DEFAULT NULL,
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
`Password` varchar(255) DEFAULT NULL, -- Giữ nguyên như bản gốc
PRIMARY KEY (`UserID`),
UNIQUE KEY `UK_Users_Email` (`Email`),
KEY `IDX_Users_Level` (`LevelCode`),
CONSTRAINT `FK_Users_Level` FOREIGN KEY (`LevelCode`) REFERENCES `Users_Level` (`LevelCode`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =========================================================
-- 2) Shops & related
-- =========================================================
CREATE TABLE `Shops` (
`ShopCode` int NOT NULL AUTO_INCREMENT,
`UserID` int NOT NULL,
`ShopName` varchar(255) NOT NULL,
`Address` varchar(255) DEFAULT NULL,
`IsApproved` char(1) NOT NULL DEFAULT 'N',
`ApprovedAt` datetime DEFAULT NULL,
`ApprovedBy` int DEFAULT NULL,
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`ShopCode`),
KEY `FK_Shops_ApprovedBy` (`ApprovedBy`),
KEY `IDX_Shops_UserID` (`UserID`),
KEY `IDX_Shops_IsApproved` (`IsApproved`),
CONSTRAINT `FK_Shops_ApprovedBy` FOREIGN KEY (`ApprovedBy`) REFERENCES `Users` (`UserID`),
CONSTRAINT `FK_Shops_User` FOREIGN KEY (`UserID`) REFERENCES `Users` (`UserID`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Shop_Wallets` (
`ShopCode` int NOT NULL,
`Balance` decimal(14,2) NOT NULL DEFAULT '0.00',
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`ShopCode`),
CONSTRAINT `FK_ShopWallets_Shops` FOREIGN KEY (`ShopCode`) REFERENCES `Shops` (`ShopCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Fields_Utilities` (
`UtilitiesID` int NOT NULL AUTO_INCREMENT,
`ShopCode` int NOT NULL,
`ParkingLot` tinyint NOT NULL DEFAULT '0',
`Toilet` tinyint NOT NULL DEFAULT '0',
`DressingRoom` tinyint NOT NULL DEFAULT '0',
`AirConditioner` tinyint NOT NULL DEFAULT '0',
`HotWater` tinyint NOT NULL DEFAULT '0',
`Wifi` tinyint NOT NULL DEFAULT '0',
PRIMARY KEY (`UtilitiesID`),
UNIQUE KEY `unique_shop_utilities` (`ShopCode`),
CONSTRAINT `Fields_Utilities_ibfk_1` FOREIGN KEY (`ShopCode`) REFERENCES `Shops` (`ShopCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `System_Settings` (
`SettingID` int NOT NULL AUTO_INCREMENT,
`SettingKey` varchar(100) NOT NULL,
`SettingValue` text,
`SettingType` enum('string','number','boolean','json') DEFAULT 'string',
`Description` varchar(255) DEFAULT NULL,
`UpdatedBy` int DEFAULT NULL,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`SettingID`),
UNIQUE KEY `SettingKey` (`SettingKey`),
KEY `IDX_Settings_Key` (`SettingKey`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =========================================================
-- 3) Fields & pricing/quantity/media
-- =========================================================
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
) ENGINE=InnoDB AUTO_INCREMENT=69 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
-- (7) CHECK: thời gian hợp lệ
CONSTRAINT `CHK_FieldPricing_Time` CHECK (`StartTime` < `EndTime`)
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
CONSTRAINT `Field_Quantity_ibfk_1` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`) ON DELETE CASCADE,
-- (7) CHECK: số lượng > 0
CONSTRAINT `CHK_FieldQuantity_Positive` CHECK (`QuantityNumber` > 0)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 4) Bookings & slots
-- =========================================================
-- Tạo Bookings TRƯỚC, chưa add FK tới Payments_Admin để tránh vòng tham chiếu
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
`BookingStatus` enum('pending','confirmed','cancelled','completed') DEFAULT 'pending',
`PaymentID` int DEFAULT NULL,
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
CONSTRAINT `Bookings_ibfk_1` FOREIGN KEY (`QuantityID`) REFERENCES `Field_Quantity` (`QuantityID`),
CONSTRAINT `FK_Bookings_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`),
CONSTRAINT `FK_Bookings_Users` FOREIGN KEY (`CustomerUserID`) REFERENCES `Users` (`UserID`)
) ENGINE=InnoDB AUTO_INCREMENT=146 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
CONSTRAINT `Field_Slots_ibfk_1` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`) ON DELETE SET NULL,
CONSTRAINT `FK_Field_Slots_Quantity` FOREIGN KEY (`QuantityID`) REFERENCES `Field_Quantity` (`QuantityID`) ON DELETE SET NULL,
-- (1) Bổ sung FK thiếu:
CONSTRAINT `FK_FieldSlots_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`),
CONSTRAINT `FK_FieldSlots_CreatedBy` FOREIGN KEY (`CreatedBy`) REFERENCES `Users` (`UserID`),
-- (7) CHECK: thời gian hợp lệ
CONSTRAINT `CHK_FieldSlots_Time` CHECK (`StartTime` < `EndTime`)
) ENGINE=InnoDB AUTO_INCREMENT=88 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Booking_Slots` (
`Slot_ID` int NOT NULL AUTO_INCREMENT,
`BookingCode` int NOT NULL,
`FieldCode` int NOT NULL,
`QuantityID` int DEFAULT NULL,
`PlayDate` date NOT NULL,
`StartTime` time NOT NULL,
`EndTime` time NOT NULL,
`PricePerSlot` int DEFAULT '100000', -- Giữ nguyên như bản gốc
`Status` enum('pending','booked','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
`CreateAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`Slot_ID`),
UNIQUE KEY `unique_slot_with_quantity` (`BookingCode`,`PlayDate`,`StartTime`,`QuantityID`),
KEY `idx_booking_code` (`BookingCode`),
KEY `idx_field_date` (`FieldCode`,`PlayDate`),
KEY `IDX_BookingSlots_QuantityID` (`QuantityID`),
CONSTRAINT `Booking_Slots_ibfk_1` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`) ON DELETE CASCADE,
CONSTRAINT `FK_BookingSlots_QuantityID` FOREIGN KEY (`QuantityID`) REFERENCES `Field_Quantity` (`QuantityID`) ON DELETE SET NULL,
-- (1) Bổ sung FK thiếu:
CONSTRAINT `FK_BookingSlots_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`)
) ENGINE=InnoDB AUTO_INCREMENT=143 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 5) Payments & logs (chú ý: cần có bảng Admin_Bank_Accounts trước)
-- =========================================================
CREATE TABLE `Payments_Admin` (
`PaymentID` int NOT NULL AUTO_INCREMENT,
`BookingCode` int NOT NULL,
`AdminBankID` int NOT NULL,
`PaymentMethod` enum('bank_transfer','card','ewallet','cash') DEFAULT 'bank_transfer',
`Amount` decimal(14,2) NOT NULL,
`TransactionCode` varchar(64) DEFAULT NULL,
`MomoTransactionID` varchar(64) DEFAULT NULL,
`MomoRequestID` varchar(64) DEFAULT NULL,
`PaidAt` datetime DEFAULT NULL,
`PaymentStatus` enum('pending','paid','failed','refunded') DEFAULT 'pending',
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`PaymentID`),
UNIQUE KEY `MomoTransactionID` (`MomoTransactionID`),
KEY `FK_PaymentsAdmin_Bookings` (`BookingCode`),
KEY `FK_PaymentsAdmin_AdminBank` (`AdminBankID`),
KEY `IDX_Payments_Status` (`PaymentStatus`),
KEY `IDX_Payments_CreateAt` (`CreateAt` DESC),
CONSTRAINT `FK_PaymentsAdmin_AdminBank` FOREIGN KEY (`AdminBankID`) REFERENCES `Admin_Bank_Accounts` (`AdminBankID`),
CONSTRAINT `FK_PaymentsAdmin_Bookings` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`)
) ENGINE=InnoDB AUTO_INCREMENT=110 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Bổ sung FK còn lại của Bookings tới Payments_Admin (tránh vòng tham chiếu ở bước tạo)
ALTER TABLE `Bookings`
ADD CONSTRAINT `FK_Bookings_Payments`
FOREIGN KEY (`PaymentID`) REFERENCES `Payments_Admin` (`PaymentID`);

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
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =========================================================
-- 6) Refunds
-- =========================================================
CREATE TABLE `Booking_Refunds` (
`RefundID` int NOT NULL AUTO_INCREMENT,
`BookingCode` int NOT NULL,
`RefundAmount` decimal(14,2) NOT NULL,
`Reason` varchar(255) DEFAULT NULL,
`Status` enum('requested','approved','rejected','completed') DEFAULT 'requested',
`RequestedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`ProcessedAt` datetime DEFAULT NULL,
`CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
`UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`RefundID`),
KEY `FK_Refunds_Bookings` (`BookingCode`),
CONSTRAINT `FK_Refunds_Bookings` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`),
-- (7) CHECK: số tiền hoàn > 0
CONSTRAINT `CHK_RefundAmount_Positive` CHECK (`RefundAmount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =========================================================
-- 7) Payouts & wallet
-- =========================================================
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
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =========================================================
-- 8) Misc
-- =========================================================
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
