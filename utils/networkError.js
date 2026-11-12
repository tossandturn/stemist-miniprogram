function networkFailure(error,{timeoutMessage='请求超时，请检查网络后重试。',defaultMessage='网络连接失败，请稍后重试。'}={}){
 const raw=[error?.errMsg,error?.message,error?.error_msg].filter(value=>typeof value==='string').join(' ')
 let code='network_error',message=defaultMessage
 if(/ERR_TUNNEL_CONNECTION_FAILED|cronet_error_code\s*:\s*-111\b/i.test(raw)){
  code='network_proxy_tunnel';message='当前网络代理连接失败，请检查代理/VPN或切换网络后重试。'
 }else if(/(?:^|[\s:])abort(?:$|[\s:])|request:fail\s+cancel/i.test(raw)){
  code='request_cancelled';message='请求已取消。'
 }else if(/not in (?:domain|legal domain) list|不在.*合法域名|域名.*校验/i.test(raw)){
  code='network_domain_blocked';message='当前版本的服务连接配置有误，请更新小程序后重试。'
 }else if(/ssl|tls|certificate|cert[ _-]|证书/i.test(raw)){
  code='network_tls_error';message='安全连接未能建立，请稍后重试。'
 }else if(/timeout|超时/i.test(raw)){
  code='network_timeout';message=timeoutMessage
 }
 // Keep raw platform detail out of errors, logs and user-visible text.
 return Object.assign(new Error(message),{code,statusCode:0})
}
module.exports={networkFailure}
