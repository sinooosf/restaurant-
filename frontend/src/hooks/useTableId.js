import { useParams } from 'react-router-dom'
import { VALID_TABLE_IDS } from '../data/tables'

export function useTableId() {
  const { tableId } = useParams()
  const isValid = VALID_TABLE_IDS.includes(tableId)
  return { tableId, isValid }
}
