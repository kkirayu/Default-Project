import * as Icons from 'antd-mobile-icons'

const MAP = {
  paycircle: Icons.PayCircleOutline,
  gift: Icons.GiftOutline,
  shop: Icons.ReceivePaymentOutline,
  more: Icons.MoreOutline,
  receipt: Icons.ReceiptOutline,
  travel: Icons.TravelOutline,
  bill: Icons.BillOutline,
  shopbag: Icons.ShopbagOutline,
  movie: Icons.MovieOutline,
  heart: Icons.HeartOutline,
  content: Icons.ContentOutline,
}

export default function CategoryIcon({ name, color = '#1677ff', size = 22 }) {
  const Icon = MAP[name] || Icons.MoreOutline
  return <Icon fontSize={size} color={color} />
}
