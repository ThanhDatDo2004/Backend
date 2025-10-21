export type ShopUtilityDefinition = {
  id: string;
  label: string;
};

export const SHOP_UTILITY_DEFINITIONS: ShopUtilityDefinition[] = [
  { id: "parking", label: "Bãi Đỗ Xe" },
  { id: "restroom", label: "Nhà Vệ Sinh" },
  { id: "changing_room", label: "Phòng Thay Đồ" },
  { id: "ac", label: "Điều Hoà" },
  { id: "hot_water", label: "Nước Nóng" },
  { id: "wifi", label: "WiFi" },
  { id: "racket_rental", label: "Thuê Vợt" },
  { id: "ball_rental", label: "Thuê Bóng" },
];

export const SHOP_UTILITY_IDS = new Set(
  SHOP_UTILITY_DEFINITIONS.map((item) => item.id)
);

export function getUtilityLabel(id: string): string {
  return (
    SHOP_UTILITY_DEFINITIONS.find((item) => item.id === id)?.label || id
  );
}
