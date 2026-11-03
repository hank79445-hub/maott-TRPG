import type {RoomCommand} from './protocol'
export function isDeliveryCommand(command:RoomCommand){
 return (command.kind==='practical-response'||command.kind==='practical-initiative'||command.kind==='practical-effect-input')&&command.operation==='delivered'
}
