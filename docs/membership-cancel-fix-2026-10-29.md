# Cancelled virtual payment recovery

Official `wx.requestVirtualPayment` uses errCode -2 for cancellation and makes outTradeNo one-use. Earlier same-trade-number resume behavior and synthetic acceptance assertions were incorrect and are superseded here.

The client now recognizes numeric cancellation independently of message text, preserves a live purchase attempt across foregrounding, reconciles a delayed native callback, never calls native payment again for a launched/cancelled/unknown trade number, and clearly preserves cancellation when order query fails. A verified server closed result clears only the matching local pointer, refreshes replacement eligibility and requires price consent again. No next order is automatically created or paid.

The regression uses the real page and membership service with synthetic HTTP/native APIs: foreground before cancellation callback, errCode -2 without cancel text, query failure, verified closure, a different replacement trade number and zero duplicate payment calls. Full npm run test:all and WeChat compilation passed. Phone payment remains separate acceptance; this source change alone does not update the user's experience version.

The backend counterpart validates the real JSON `biz_meta.attach` envelope, retains the closed order, records provider closure evidence, and atomically reserves a fresh key only for a verified closed attempt. Existing compatible clients can recover by refreshing the original order and then membership state.

Source: https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html
