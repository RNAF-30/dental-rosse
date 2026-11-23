const $ = id => document.getElementById(id);
let whatsappReady = false;
const money = cents => cents == null ? "Consultar" : new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
async function api(url, options={}) {
  const response = await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || "Ocurrió un error.");
  return data;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function loadProducts(){
 const items=await api("/api/products");
 $("products").innerHTML=items.length?items.map(p=>`<article class="card"><div class="visual">🦷</div><div class="content"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="price">${money(p.price_cents)}</div><a class="btn" href="#pedidos">Consultar</a></div></article>`).join(""):"<p>Estamos preparando nuestro catálogo. Contáctanos para más información.</p>";
}
async function init(){
 $("year").textContent=new Date().getFullYear();
 const config=await api("/api/config");
 if(config.whatsappConfigured){$("wa").href="https://wa.me/"+config.whatsappNumber;$("wa").classList.remove("hidden");}
 await loadProducts();
 const me=await api("/api/admin/me");
 if(me.authenticated) showDashboard();
}
$("orderForm").addEventListener("submit",async e=>{
 e.preventDefault(); const btn=$("sendOrder");btn.disabled=true;
 const payload={name:$("name").value,phone:$("phone").value,customerType:$("customerType").value,service:$("service").value,details:$("details").value};
 try{
  const result=await api("/api/orders",{method:"POST",body:JSON.stringify(payload)});
  $("formMessage").textContent="Solicitud recibida. Número de referencia: "+result.id+".";
  const config=await api("/api/config");
  if(config.whatsappConfigured){
   const msg=`Hola, soy ${payload.name}. Envié la solicitud ${result.id} a través de la web de Dental Rosse. Me interesa: ${payload.service}.`;
   window.open("https://wa.me/"+config.whatsappNumber+"?text="+encodeURIComponent(msg),"_blank","noopener");
  }
  e.target.reset();
 }catch(err){$("formMessage").textContent=err.message;}
 finally{btn.disabled=false;}
});
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();$("loginMessage").textContent="";
 try{await api("/api/admin/login",{method:"POST",body:JSON.stringify({username:$("username").value,password:$("password").value})});$("password").value="";showDashboard();}
 catch(err){$("loginMessage").textContent=err.message;}
});
async function showDashboard(){
 $("loginBox").classList.add("hidden");$("dashboard").classList.remove("hidden");
 await Promise.all([loadOrders(),loadAdminProducts()]);
}
async function loadOrders(){
 const orders=await api("/api/admin/orders");
 $("ordersList").innerHTML=orders.length?orders.map(o=>`<div class="admin-item"><div><b>#${o.id} · ${esc(o.name)}</b><p>${esc(o.phone)} · ${esc(o.customer_type)} · ${esc(o.service)}</p><p>${esc(o.details)}</p><small>${esc(o.created_at)}</small></div><div><select data-order="${o.id}">${["Nuevo","En revisión","En proceso","Completado","Cancelado"].map(s=>`<option ${o.status===s?"selected":""}>${s}</option>`).join("")}</select></div></div>`).join(""):"Todavía no hay pedidos.";
 document.querySelectorAll("[data-order]").forEach(sel=>sel.addEventListener("change",async()=>{try{await api("/api/admin/orders/"+sel.dataset.order,{method:"PATCH",body:JSON.stringify({status:sel.value})});}catch(e){alert(e.message);}}));
}
async function loadAdminProducts(){
 const items=await api("/api/products");
 $("adminProducts").innerHTML=items.map(p=>`<div class="admin-item"><span>${esc(p.name)} · ${money(p.price_cents)}</span><button class="btn" data-delete="${p.id}">Desactivar</button></div>`).join("")||"Sin productos.";
 document.querySelectorAll("[data-delete]").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm("¿Desactivar este producto?"))return;try{await api("/api/admin/products/"+btn.dataset.delete,{method:"DELETE"});await loadProducts();await loadAdminProducts();}catch(e){alert(e.message);}}));
}
$("productForm").addEventListener("submit",async e=>{
 e.preventDefault();
 try{
  const price=$("productPrice").value;
  await api("/api/admin/products",{method:"POST",body:JSON.stringify({name:$("productName").value,description:$("productDescription").value,price:price===""?null:Number(price)})});
  $("productMessage").textContent="Producto guardado.";
  e.target.reset();await loadProducts();await loadAdminProducts();
 }catch(err){$("productMessage").textContent=err.message;}
});
$("logout").addEventListener("click",async()=>{await api("/api/admin/logout",{method:"POST"});$("dashboard").classList.add("hidden");$("loginBox").classList.remove("hidden");});
init().catch(err=>console.error(err));
