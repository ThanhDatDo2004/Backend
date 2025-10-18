CREATE TABLE `Users_Level` (
  `LevelCode` int NOT NULL,
  `LevelType` enum('cus','shop','admin') NOT NULL,
  `isActive` tinyint(1) DEFAULT NULL,
  `_destroy` tinyint DEFAULT NULL,
  PRIMARY KEY (`LevelCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

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
  `Password` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`UserID`),
  UNIQUE KEY `UK_Users_Email` (`Email`),
  KEY `IDX_Users_Level` (`LevelCode`),
  CONSTRAINT `FK_Users_Level` FOREIGN KEY (`LevelCode`) REFERENCES `Users_Level` (`LevelCode`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `Users_Verification` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `UserCode` int NOT NULL,
  `Email` varchar(190) NOT NULL,
  `Code` varchar(64) NOT NULL,
  `ExpiresAt` datetime NOT NULL,
  `Consumed` char(1) NOT NULL DEFAULT 'N',
  `CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `FK_UsersVerification_User` (`UserCode`),
  KEY `IDX_UsersVerification_Email` (`Email`),
  KEY `IDX_UsersVerification_Expires` (`ExpiresAt`),
  CONSTRAINT `FK_UsersVerification_User` FOREIGN KEY (`UserCode`) REFERENCES `Users` (`UserID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

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
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `Admin_Bank_Accounts` (
  `AdminBankID` int NOT NULL AUTO_INCREMENT,
  `BankName` varchar(120) NOT NULL,
  `AccountNumber` varchar(64) NOT NULL,
  `AccountHolder` varchar(120) NOT NULL,
  `IsActive` char(1) DEFAULT 'Y',
  `IsDefault` char(1) DEFAULT 'Y',
  `CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`AdminBankID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `Shop_Wallets` (
  `ShopCode` int NOT NULL,
  `Balance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ShopCode`),
  CONSTRAINT `FK_ShopWallets_Shops` FOREIGN KEY (`ShopCode`) REFERENCES `Shops` (`ShopCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

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
  KEY `FK_WalletTransactions_Wallet` (`ShopCode`),
  KEY `FK_WalletTransactions_Bookings` (`BookingCode`),
  KEY `FK_WalletTxn_Payout` (`PayoutID`),
  CONSTRAINT `FK_WalletTransactions_Bookings` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`),
  CONSTRAINT `FK_WalletTransactions_Wallet` FOREIGN KEY (`ShopCode`) REFERENCES `Shop_Wallets` (`ShopCode`),
  CONSTRAINT `FK_WalletTxn_Payout` FOREIGN KEY (`PayoutID`) REFERENCES `Payout_Requests` (`PayoutID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `Fields` (
  `FieldCode` int NOT NULL AUTO_INCREMENT,
  `ShopCode` int NOT NULL,
  `FieldName` varchar(255) NOT NULL,
  `SportType` enum('badminton','football','baseball','swimming','tennis') NOT NULL,
  `Address` varchar(255) DEFAULT NULL,
  `DefaultPricePerHour` decimal(10,2) NOT NULL DEFAULT '0.00',
  `Status` enum('active','maintenance','inactive') DEFAULT 'active',
  `CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`FieldCode`),
  KEY `FK_Fields_Shops` (`ShopCode`),
  CONSTRAINT `FK_Fields_Shops` FOREIGN KEY (`ShopCode`) REFERENCES `Shops` (`ShopCode`)
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

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
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

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
  CONSTRAINT `FK_FieldPricing_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `Field_Slots` (
  `SlotID` int NOT NULL AUTO_INCREMENT,
  `FieldCode` int NOT NULL,
  `PlayDate` date NOT NULL,
  `StartTime` time NOT NULL,
  `EndTime` time NOT NULL,
  `Status` enum('available','held','booked','blocked') NOT NULL DEFAULT 'available',
  `BookingCode` int DEFAULT NULL,
  `HoldExpiresAt` datetime DEFAULT NULL,
  `CreatedBy` int DEFAULT NULL,
  `CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`SlotID`),
  UNIQUE KEY `UQ_FieldSlots` (`FieldCode`,`PlayDate`,`StartTime`,`EndTime`),
  UNIQUE KEY `BookingCode` (`BookingCode`),
  CONSTRAINT `FK_FieldSlots_Bookings` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`),
  CONSTRAINT `FK_FieldSlots_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `Bookings` (
  `BookingCode` int NOT NULL AUTO_INCREMENT,
  `FieldCode` int NOT NULL,
  `CustomerUserID` int NOT NULL,
  `CustomerName` varchar(120) DEFAULT NULL,
  `CustomerEmail` varchar(120) DEFAULT NULL,
  `CustomerPhone` varchar(30) DEFAULT NULL,
  `PlayDate` date NOT NULL,
  `StartTime` time NOT NULL,
  `EndTime` time NOT NULL,
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
  PRIMARY KEY (`BookingCode`),
  UNIQUE KEY `CheckinCode` (`CheckinCode`),
  UNIQUE KEY `PaymentID` (`PaymentID`),
  KEY `FK_Bookings_Users` (`CustomerUserID`),
  KEY `IDX_Bookings_FieldDate` (`FieldCode`,`PlayDate`),
  CONSTRAINT `FK_Bookings_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`),
  CONSTRAINT `FK_Bookings_Payments` FOREIGN KEY (`PaymentID`) REFERENCES `Payments_Admin` (`PaymentID`),
  CONSTRAINT `FK_Bookings_Users` FOREIGN KEY (`CustomerUserID`) REFERENCES `Users` (`UserID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

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
  CONSTRAINT `FK_PaymentsAdmin_AdminBank` FOREIGN KEY (`AdminBankID`) REFERENCES `Admin_Bank_Accounts` (`AdminBankID`),
  CONSTRAINT `FK_PaymentsAdmin_Bookings` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `Reviews` (
  `ReviewCode` int NOT NULL AUTO_INCREMENT,
  `FieldCode` int NOT NULL,
  `CustomerUserID` int NOT NULL,
  `Rating` tinyint NOT NULL,
  `Comment` text,
  `CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ReviewCode`),
  KEY `FK_Reviews_Fields` (`FieldCode`),
  KEY `FK_Reviews_Users` (`CustomerUserID`),
  CONSTRAINT `FK_Reviews_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields` (`FieldCode`),
  CONSTRAINT `FK_Reviews_Users` FOREIGN KEY (`CustomerUserID`) REFERENCES `Users` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `Notifications` (
  `NotificationID` int NOT NULL AUTO_INCREMENT,
  `UserID` int NOT NULL,
  `Type` enum('booking','wallet','payout','system') NOT NULL,
  `Title` varchar(200) NOT NULL,
  `Content` text,
  `IsRead` char(1) DEFAULT 'N',
  `CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`NotificationID`),
  KEY `FK_Notifications_Users` (`UserID`),
  CONSTRAINT `FK_Notifications_Users` FOREIGN KEY (`UserID`) REFERENCES `Users` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `Shop_Applications` (
  `RequestID` int NOT NULL AUTO_INCREMENT,
  `ApplicantUserID` int NOT NULL,
  `ShopName` varchar(255) NOT NULL,
  `Address` varchar(255) DEFAULT NULL,
  `PhoneNumber` varchar(30) DEFAULT NULL,
  `Email` varchar(190) DEFAULT NULL,
  `BankName` varchar(120) DEFAULT NULL,
  `AccountNumber` varchar(64) DEFAULT NULL,
  `AccountHolder` varchar(120) DEFAULT NULL,
  `Status` enum('submitted','reviewed','approved','rejected') DEFAULT 'submitted',
  `CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ProcessedAt` datetime DEFAULT NULL,
  `AdminNote` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`RequestID`),
  KEY `FK_ShopApplications_Users` (`ApplicantUserID`),
  CONSTRAINT `FK_ShopApplications_Users` FOREIGN KEY (`ApplicantUserID`) REFERENCES `Users` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `Payment_Methods` (
  `PaymentMethodID` int NOT NULL AUTO_INCREMENT,
  `UserID` int NOT NULL,
  `MethodType` enum('momo','bank_transfer','card','ewallet') NOT NULL,
  `MethodData` json NOT NULL,
  `IsDefault` char(1) DEFAULT 'N',
  `IsVerified` char(1) DEFAULT 'N',
  `CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`PaymentMethodID`),
  KEY `FK_PaymentMethods_Users` (`UserID`),
  CONSTRAINT `FK_PaymentMethods_Users` FOREIGN KEY (`UserID`) REFERENCES `Users` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `Checkin_Verifications` (
  `CheckinID` int NOT NULL AUTO_INCREMENT,
  `BookingCode` int NOT NULL,
  `Code` varchar(32) NOT NULL,
  `IsUsed` char(1) DEFAULT 'N',
  `VerifiedAt` datetime DEFAULT NULL,
  `ExpiredAt` datetime DEFAULT NULL,
  `CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`CheckinID`),
  UNIQUE KEY `Code` (`Code`),
  KEY `FK_Checkin_Bookings` (`BookingCode`),
  CONSTRAINT `FK_Checkin_Bookings` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

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
  CONSTRAINT `FK_Refunds_Bookings` FOREIGN KEY (`BookingCode`) REFERENCES `Bookings` (`BookingCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `Audit_Logs` (
  `LogID` int NOT NULL AUTO_INCREMENT,
  `UserID` int DEFAULT NULL,
  `Entity` varchar(100) DEFAULT NULL,
  `EntityID` int DEFAULT NULL,
  `Action` varchar(50) DEFAULT NULL,
  `OldData` json DEFAULT NULL,
  `NewData` json DEFAULT NULL,
  `IPAddress` varchar(45) DEFAULT NULL,
  `CreateAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`LogID`),
  KEY `IDX_AuditLogs_Entity` (`Entity`,`EntityID`),
  KEY `IDX_AuditLogs_User` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
