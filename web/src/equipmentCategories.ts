export const NCR_CITIES = ['Caloocan','Las Piñas','Makati','Malabon','Mandaluyong','Manila','Marikina','Muntinlupa','Navotas','Parañaque','Pasay','Pasig','Pateros','Quezon City','San Juan','Taguig','Valenzuela']
export const INVENTORY_REGIONS = ['NCR','CAR','Region I','Region II','Region III','Region IV-A','MIMAROPA','Region V','Region VI','NIR','Region VII','Region VIII','Region IX','Region X','Region XI','Region XII','Region XIII','BARMM']
export type EquipmentRow = {id:string;site_id:string;site_name?:string;subject_name?:string;data:Record<string,unknown>}
export function equipmentCategory(row:EquipmentRow,assets:EquipmentRow[],accountability:boolean) {
  const asset=accountability ? assets.find(asset=>asset.id===row.data.equipment_id) : row
  return {region:String(asset?.data.location_region || 'Uncategorized'),city:String(asset?.data.location_city || 'Uncategorized'),category:String(asset?.data.category || 'Uncategorized'),status:accountability ? row.data.returned_at ? 'Returned' : row.data.acknowledged ? 'Acknowledged' : 'Awaiting acknowledgment' : String(row.data.status || 'Uncategorized'),title:String(asset?.data.title || 'Equipment unavailable')}
}
export function matchesEquipment(row:EquipmentRow,assets:EquipmentRow[],accountability:boolean,filters:Record<string,string>) {
  const meta=equipmentCategory(row,assets,accountability)
  return Object.entries(filters).every(([key,value])=>!value || (key==='site' ? row.site_id : meta[key as keyof typeof meta])===value)
}
