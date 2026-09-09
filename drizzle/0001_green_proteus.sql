CREATE TABLE `product_catalog_amendments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` varchar(64) NOT NULL,
	`fieldName` varchar(64) NOT NULL,
	`fieldValue` text NOT NULL,
	`amendedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_catalog_amendments_id` PRIMARY KEY(`id`),
	CONSTRAINT `brand_field_unique` UNIQUE(`brandId`,`fieldName`)
);
