export type Role = "ADMIN" | "WAITER" | "KITCHEN";
export type TableStatus = "EMPTY" | "OCCUPIED";
export type OrderStatus = "PENDING" | "PREPARING" | "COMPLETED" | "CANCELLED";

export interface CategoryWithChildren {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  active: boolean;
  parentId?: string | null;
  children?: CategoryWithChildren[];
  items?: MenuItemData[];
  _count?: {
    items: number;
    children: number;
  };
}

export interface MenuItemData {
  id: string;
  name: string;
  description?: string | null;
  allergens?: string | null;
  active: boolean;
  displayOrder: number;
  categoryId: string;
  category?: {
    id: string;
    name: string;
  };
}

export interface RestaurantData {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  active: boolean;
  tablesCount?: number;
  activeOrdersCount?: number;
}

export interface TableData {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  restaurantId: string;
  restaurant?: {
    id: string;
    name: string;
  };
  activeOrders?: any[];
}

export interface OrderItemInput {
  menuItemId: string;
  name: string;
  quantity: number;
  itemNotes?: string;
}
