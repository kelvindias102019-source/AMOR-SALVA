const base=String(process.env.BRAVOPAY_API_URL||'https://bravopay.club/api/v1').replace(/\/$/,'');

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
      source:tracking.utm_source||'',
      medium:tracking.utm_medium||'',
      campaign:tracking.utm_campaign||'',
      content:tracking.utm_content||'',
      term:tracking.utm_term||'',
      fbclid:tracking.fbclid||'',
      gclid:tracking.gclid||'',
      ttclid:tracking.ttclid||''
    }
  };

  // Remove campos opcionais vazios antes de enviar.
  Object.keys(body.customer).forEach(key=>body.customer[key]===undefined&&delete body.customer[key]);

  const response=await fetch(`${base}/transactions`,{
    method:'POST',
    headers:{
      Authorization:`Bearer ${process.env.BRAVOPAY_API_KEY}`,
      'Content-Type':'application/json',
      'Idempotency-Key':externalReference
    },
    body:JSON.stringify(body)
  });

  const raw=await response.text();
  let data={};
  try{data=raw?JSON.parse(raw):{}}catch{data={raw:raw.slice(0,500)}}

  if(!response.ok){
    console.error('BravoPay error',{status:response.status,body:data});
    throw new Error(data?.error?.message||data?.message||'Falha ao gerar cobrança PIX');
  }

  return data;
}
