SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================
-- A) NHÓM TÀI KHOẢN & PHÂN QUYỀN (GIỮ NGUYÊN)
-- =========================================
CREATE TABLE IF NOT EXISTS `Users_Level` (
  `LevelCode` INT AUTO_INCREMENT PRIMARY KEY,
  `LevelType` ENUM('cus','shop','admin') NOT NULL,
  `isActive`  TINYINT(1),
  `_destroy`  TINYINT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Users` (
  `UserID`       INT AUTO_INCREMENT PRIMARY KEY,
  `LevelCode`    INT NOT NULL,
  `FullName`     VARCHAR(120) NOT NULL,
  `Email`        VARCHAR(190) NOT NULL,
  `PhoneNumber`  VARCHAR(30),
  `PasswordHash` VARCHAR(255) NOT NULL,
  `IsActive`     TINYINT(1),
  `_destroy`     TINYINT,
  `CreateAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Password`     VARCHAR(255) NULL,
  CONSTRAINT `FK_Users_Level` FOREIGN KEY (`LevelCode`) REFERENCES `Users_Level`(`LevelCode`),
  UNIQUE KEY `UK_Users_Email` (`Email`),
  KEY `IDX_Users_Level` (`LevelCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Users_Verification` (
  `Id`        INT AUTO_INCREMENT PRIMARY KEY,
  `UserCode`  INT NOT NULL,
  `Email`     VARCHAR(190) NOT NULL,
  `Code`      VARCHAR(64)  NOT NULL,
  `ExpiresAt` DATETIME NOT NULL,
  `Consumed`  CHAR(1) NOT NULL DEFAULT 'N',
  `CreateAt`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `FK_UsersVerification_User` FOREIGN KEY (`UserCode`) REFERENCES `Users`(`UserID`),
  KEY `IDX_UsersVerification_Email` (`Email`),
  KEY `IDX_UsersVerification_Expires` (`ExpiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================
-- B) SHOP, NGÂN HÀNG, VÍ
-- =========================================
CREATE TABLE IF NOT EXISTS `Shops` (
  `ShopCode`   INT AUTO_INCREMENT PRIMARY KEY,
  `UserID`     INT NOT NULL,
  `ShopName`   VARCHAR(255) NOT NULL,
  `Address`    VARCHAR(255),
  `IsApproved` CHAR(1) NOT NULL DEFAULT 'N',
  `ApprovedAt` DATETIME NULL,
  `ApprovedBy` INT NULL,
  `CreateAt`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `FK_Shops_User`       FOREIGN KEY (`UserID`)    REFERENCES `Users`(`UserID`),
  CONSTRAINT `FK_Shops_ApprovedBy` FOREIGN KEY (`ApprovedBy`) REFERENCES `Users`(`UserID`),
  KEY `IDX_Shops_UserID` (`UserID`),
  KEY `IDX_Shops_IsApproved` (`IsApproved`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Shop_Bank_Accounts` (
  `ShopBankID`    INT AUTO_INCREMENT PRIMARY KEY,
  `ShopCode`      INT NOT NULL,
  `BankName`      VARCHAR(120) NOT NULL,
  `AccountNumber` VARCHAR(64)  NOT NULL,
  `AccountHolder` VARCHAR(120) NOT NULL,
  `IsDefault`     CHAR(1) DEFAULT 'N',
  `IsVerified`    CHAR(1) DEFAULT 'N',
  `CreateAt`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `FK_ShopBankAccounts_Shops` FOREIGN KEY (`ShopCode`) REFERENCES `Shops`(`ShopCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Admin_Bank_Accounts` (
  `AdminBankID`  INT AUTO_INCREMENT PRIMARY KEY,
  `BankName`     VARCHAR(120) NOT NULL,
  `AccountNumber` VARCHAR(64)  NOT NULL,
  `AccountHolder` VARCHAR(120) NOT NULL,
  `IsActive`     CHAR(1) DEFAULT 'Y',
  `IsDefault`    CHAR(1) DEFAULT 'Y',
  `CreateAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Shop_Wallets` (
  `ShopCode` INT PRIMARY KEY,
  `Balance`  DECIMAL(14,2) NOT NULL DEFAULT 0,
  `CreateAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `FK_ShopWallets_Shops` FOREIGN KEY (`ShopCode`) REFERENCES `Shops`(`ShopCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Wallet_Transactions` (
  `WalletTxnID` INT AUTO_INCREMENT PRIMARY KEY,
  `ShopCode`    INT NOT NULL,
  `BookingCode` INT NULL,
  `Type`        ENUM('credit_settlement','debit_payout','adjustment') NOT NULL,
  `Amount`      DECIMAL(14,2) NOT NULL,
  `Note`        VARCHAR(255),
  `CreateAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `FK_WalletTransactions_Wallet` FOREIGN KEY (`ShopCode`) REFERENCES `Shop_Wallets`(`ShopCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================
-- C) FIELDS, GIÁ & LỊCH
-- =========================================
CREATE TABLE IF NOT EXISTS `Fields` (
  `FieldCode`            INT AUTO_INCREMENT PRIMARY KEY,
  `ShopCode`             INT NOT NULL,
  `FieldName`            VARCHAR(255) NOT NULL,
  `SportType`            ENUM('badminton','football','baseball','swimming','tennis') NOT NULL,
  `Address`              VARCHAR(255),
  `DefaultPricePerHour`  DECIMAL(10,2) NOT NULL DEFAULT 0,
  `Status`               ENUM('active','maintenance','inactive') DEFAULT 'active',
  `CreateAt`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `FK_Fields_Shops` FOREIGN KEY (`ShopCode`) REFERENCES `Shops`(`ShopCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Field_Images` (
  `ImageCode` INT AUTO_INCREMENT PRIMARY KEY,
  `FieldCode` INT NOT NULL,
  `ImageUrl`  VARCHAR(500) NOT NULL,
  `SortOrder` INT DEFAULT 0,
  `CreateAt`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `FK_FieldImages_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields`(`FieldCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Field_Pricing` (
  `PricingID`    INT AUTO_INCREMENT PRIMARY KEY,
  `FieldCode`    INT NOT NULL,
  `DayOfWeek`    TINYINT NOT NULL,
  `StartTime`    TIME NOT NULL,
  `EndTime`      TIME NOT NULL,
  `PricePerHour` DECIMAL(10,2) NOT NULL,
  `CreateAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `FK_FieldPricing_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields`(`FieldCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Field_Slots` (
  `SlotID`        INT AUTO_INCREMENT PRIMARY KEY,
  `FieldCode`     INT NOT NULL,
  `PlayDate`      DATE NOT NULL,
  `StartTime`     TIME NOT NULL,
  `EndTime`       TIME NOT NULL,
  `Status`        ENUM('available','held','booked','blocked') NOT NULL DEFAULT 'available',
  `HoldExpiresAt` DATETIME NULL,
  `CreatedBy`     INT NULL,
  `CreateAt`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `FK_FieldSlots_Fields` FOREIGN KEY (`FieldCode`) REFERENCES `Fields`(`FieldCode`),
  CONSTRAINT `UQ_FieldSlots` UNIQUE (`FieldCode`,`PlayDate`,`StartTime`,`EndTime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================
-- D) ĐẶT SÂN, THANH TOÁN, RÚT TIỀN
-- =========================================
CREATE TABLE IF NOT EXISTS `Bookings` (
  `BookingCode`    INT AUTO_INCREMENT PRIMARY KEY,
  `FieldCode`      INT NOT NULL,
  `CustomerUserID` INT NOT NULL,
  `CustomerName`   VARCHAR(120),
  `CustomerEmail`  VARCHAR(120),
  `CustomerPhone`  VARCHAR(30),
  `PlayDate`       DATE NOT NULL,
  `StartTime`      TIME NOT NULL,
  `EndTime`        TIME NOT NULL,
  `TotalPrice`     DECIMAL(14,2) NOT NULL,
  `PlatformFee`    DECIMAL(14,2) NOT NULL,
  `NetToShop`      DECIMAL(14,2) NOT NULL,
  `BookingStatus`  ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  `CheckinCode`    VARCHAR(32) UNIQUE,
  `CreateAt`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `FK_Bookings_Fields` FOREIGN KEY (`FieldCode`)      REFERENCES `Fields`(`FieldCode`),
  CONSTRAINT `FK_Bookings_Users`  FOREIGN KEY (`CustomerUserID`) REFERENCES `Users`(`UserID`),
  KEY `IDX_Bookings_FieldDate` (`FieldCode`,`PlayDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Payments_Admin` (
  `PaymentID`      INT AUTO_INCREMENT PRIMARY KEY,
  `BookingCode`    INT NOT NULL,
  `AdminBankID`    INT NOT NULL,
  `PaymentMethod`  ENUM('bank_transfer','card','ewallet','cash') DEFAULT 'bank_transfer',
  `Amount`         DECIMAL(14,2) NOT NULL,
  `TransactionCode` VARCHAR(64),
  `PaidAt`         DATETIME,
  `PaymentStatus`  ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
  `CreateAt`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `FK_PaymentsAdmin_Bookings`  FOREIGN KEY (`BookingCode`) REFERENCES `Bookings`(`BookingCode`),
  CONSTRAINT `FK_PaymentsAdmin_AdminBank` FOREIGN KEY (`AdminBankID`) REFERENCES `Admin_Bank_Accounts`(`AdminBankID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Payout_Requests` (
  `PayoutID`    INT AUTO_INCREMENT PRIMARY KEY,
  `ShopCode`    INT NOT NULL,
  `ShopBankID`  INT NOT NULL,
  `Amount`      DECIMAL(14,2) NOT NULL,
  `Status`      ENUM('requested','processing','paid','rejected') DEFAULT 'requested',
  `RequestedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ProcessedAt` DATETIME NULL,
  `Note`        VARCHAR(255),
  `CreateAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdateAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `FK_PayoutRequests_Shops` FOREIGN KEY (`ShopCode`)   REFERENCES `Shops`(`ShopCode`),
  CONSTRAINT `FK_PayoutRequests_Banks` FOREIGN KEY (`ShopBankID`) REFERENCES `Shop_Bank_Accounts`(`ShopBankID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Thêm FK sau khi cả hai bảng tồn tại
ALTER TABLE `Wallet_Transactions`
  ADD CONSTRAINT `FK_WalletTransactions_Bookings`
  FOREIGN KEY (`BookingCode`) REFERENCES `Bookings`(`BookingCode`);

-- =========================================
-- E) ĐÁNH GIÁ & PHỤ TRỢ
-- =========================================
CREATE TABLE IF NOT EXISTS `Reviews` (
  `ReviewCode`     INT AUTO_INCREMENT PRIMARY KEY,
  `FieldCode`      INT NOT NULL,
  `CustomerUserID` INT NOT NULL,
  `Rating`         TINYINT NOT NULL,
  `Comment`        TEXT,
  `CreateAt`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `FK_Reviews_Fields` FOREIGN KEY (`FieldCode`)      REFERENCES `Fields`(`FieldCode`),
  CONSTRAINT `FK_Reviews_Users`  FOREIGN KEY (`CustomerUserID`) REFERENCES `Users`(`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Notifications` (
  `NotificationID` INT AUTO_INCREMENT PRIMARY KEY,
  `UserID`         INT NOT NULL,
  `Type`           ENUM('booking','wallet','payout','system') NOT NULL,
  `Title`          VARCHAR(200) NOT NULL,
  `Content`        TEXT,
  `IsRead`         CHAR(1) DEFAULT 'N',
  `CreateAt`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `FK_Notifications_Users` FOREIGN KEY (`UserID`) REFERENCES `Users`(`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Shop_Applications` (
  `RequestID`       INT AUTO_INCREMENT PRIMARY KEY,
  `ApplicantUserID` INT NOT NULL,
  `ShopName`        VARCHAR(255) NOT NULL,
  `Address`         VARCHAR(255),
  `PhoneNumber`     VARCHAR(30),
  `Email`           VARCHAR(190),
  `Status`          ENUM('submitted','approved','rejected') DEFAULT 'submitted',
  `CreateAt`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ProcessedAt`     DATETIME NULL,
  `AdminNote`       VARCHAR(255),
  CONSTRAINT `FK_ShopApplications_Users` FOREIGN KEY (`ApplicantUserID`) REFERENCES `Users`(`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
