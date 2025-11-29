"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOP_UTILITY_IDS = exports.SHOP_UTILITY_DEFINITIONS = void 0;
exports.getUtilityLabel = getUtilityLabel;
exports.SHOP_UTILITY_DEFINITIONS = [
    { id: "parking", label: "Bãi Đỗ Xe" },
    { id: "restroom", label: "Nhà Vệ Sinh" },
    { id: "changing_room", label: "Phòng Thay Đồ" },
    { id: "ac", label: "Điều Hoà" },
    { id: "hot_water", label: "Nước Nóng" },
    { id: "wifi", label: "WiFi" },
    { id: "racket_rental", label: "Thuê Vợt" },
    { id: "ball_rental", label: "Thuê Bóng" },
];
exports.SHOP_UTILITY_IDS = new Set(exports.SHOP_UTILITY_DEFINITIONS.map((item) => item.id));
function getUtilityLabel(id) {
    return (exports.SHOP_UTILITY_DEFINITIONS.find((item) => item.id === id)?.label || id);
}
