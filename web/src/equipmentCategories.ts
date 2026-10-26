export const NCR_CITIES = ['Caloocan','Las Piñas','Makati','Malabon','Mandaluyong','Manila','Marikina','Muntinlupa','Navotas','Parañaque','Pasay','Pasig','Pateros','Quezon City','San Juan','Taguig','Valenzuela']
export const INVENTORY_REGIONS = ['NCR','CAR','Region I','Region II','Region III','Region IV-A','MIMAROPA','Region V','Region VI','NIR','Region VII','Region VIII','Region IX','Region X','Region XI','Region XII','Region XIII','BARMM']
export const EQUIPMENT_CATEGORIES = ['Protective Gear','Communication Devices','Surveillance Equipment','Inspection Tools','Firearms & Security Equipment','Access Control','Emergency Equipment','Uniforms','Other Equipment']
export function inferredEquipmentCategory(title:string) {
  const name=title.toLowerCase()
  if (/vest|helmet|body armor|protective|shield/.test(name)) return 'Protective Gear'
  if (/radio|walkie|transceiver|communication/.test(name)) return 'Communication Devices'
  if (/cctv|camera|surveillance|recorder/.test(name)) return 'Surveillance Equipment'
  if (/torch|flashlight|inspection|metal detector/.test(name)) return 'Inspection Tools'
  if (/firearm|pistol|rifle|holster|ammunition/.test(name)) return 'Firearms & Security Equipment'
  if (/key|rfid|access card|badge|lock/.test(name)) return 'Access Control'
  if (/first aid|fire extinguisher|emergency|medical kit/.test(name)) return 'Emergency Equipment'
  if (/uniform|boot|raincoat|cap|shirt/.test(name)) return 'Uniforms'
  return 'Other Equipment'
}
export type EquipmentRow = {id:string;site_id:string;site_name?:string;subject_name?:string;data:Record<string,unknown>}
export function equipmentCategory(row:EquipmentRow,assets:EquipmentRow[],accountability:boolean) {
  const asset=accountability ? assets.find(asset=>asset.id===row.data.equipment_id) : row
  return {region:String(asset?.data.location_region || 'Uncategorized'),city:String(asset?.data.location_city || 'Uncategorized'),category:String(asset?.data.category && asset.data.category !== 'Uncategorized' ? asset.data.category : inferredEquipmentCategory(String(asset?.data.title || ''))),status:accountability ? row.data.returned_at ? 'Returned' : row.data.acknowledged ? 'Acknowledged' : 'Awaiting acknowledgment' : String(row.data.status || 'Uncategorized'),title:String(asset?.data.title || 'Equipment unavailable')}
}
export function matchesEquipment(row:EquipmentRow,assets:EquipmentRow[],accountability:boolean,filters:Record<string,string>) {
  const meta=equipmentCategory(row,assets,accountability)
  return Object.entries(filters).every(([key,value])=>!value || (key==='site' ? row.site_id : meta[key as keyof typeof meta])===value)
}
