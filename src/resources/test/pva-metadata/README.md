# PVA metadata compatibility fixture

`legacy-precision.sample` is one escaped PB ScalarDouble sample, without a payload header, from year 2026. It was emitted by the pre-M25 engine WAR through a real Java PVA server and the production PVA receiver and PB writer. The server supplied display precision 3, then changed control minStep from 0.125 to 0.25 with a new timestamp. The legacy writer stored PREC=0.25. Readers must preserve that stored value; correcting new writes does not reinterpret old samples.

Source WAR SHA-256: `6ce070fc7696757316615935158600a58afcdd94876c1dc7e17b97e30055de4c`.
