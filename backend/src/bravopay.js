const base=String(process.env.BRAVOPAY_API_URL||'https://bravopay.club/api/v1').replace(/\/$/,'');
const TIMEOUT_MS=Math.min(Math.max(Number(process.env.BRAVOPAY_TIMEOUT_MS||12000),3000),30000);

export async function createPix({amount,customer,externalReference,tracking={}}){
  const body={
    amount_cents:Math.round(Number(amount)*100),
    method:'pix',
    customer:{
      name:customer?.name||'Doador anônimo',
      email:customer?.email||undefined,
      cpf:customer?.cpf||undefined,
      phone:customer?.phone||undefined
    },
    description:'Doação Instituto Amor Salva',
    external_reference:externalReference,
    expires_in:Number(process.env.BRAVOPAY_PIX_EXPIRES_IN||3600),
    metadata:{campaign:'instituto-amor-salva',domain:'institutodoacao.online'},
    utm:{
      source:tracking.utm_source||'',medium:tracking.utm_medium||'',campaign:tracking.utm_campaign||'',
      content:tracking.utm_content||'',term:tracking.utm_term||'',fbclid:tracking.fbclid||'',
      gclid:tracking.gclid||'',ttclid:tracking.ttclid||''
    }
  };
  Object.keys(body.customer).forEach(key=>body.customer[key]===undefined&&delete body.customer[key]);

  let response;
  try{
    response=await fetch(`${base}/transactions`,{
      method:'POST',
      headers:{Authorization:`Bearer ${process.env.BRAVOPAY_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':externalReference},
      body:JSON.stringify(body),signal:AbortSignal.timeout(TIMEOUT_MS)
    });
  }catch(error){
    if(error?.name==='TimeoutError'||error?.name==='AbortError')throw new Error('BRAVOPAY_TIMEOUT');
    throw new Error('BRAVOPAY_UNAVAILABLE');
  }

  const raw=await response.text();
  let data={};
  try{data=raw?JSON.parse(raw):{}}catch{data={}}
  if(!response.ok){
    console.error('BravoPay request failed',{status:response.status,code:data?.error?.code||data?.code||'unknown'});
    const err=new Error('BRAVOPAY_REJECTED'); err.status=response.status; throw err;
  }
  return data;
}
