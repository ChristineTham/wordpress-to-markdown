function toISOLocal(d) {
  const z = n => ('0' + n).slice(-2);
  let off = d.getTimezoneOffset();
  const sign = off < 0 ? '+' : '-';
  off = Math.abs(off);
  return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, -1) + sign + z(off / 60 | 0) + ':' + z(off % 60);
}
console.log(toISOLocal(new Date()));
