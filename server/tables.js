const {Router, query} = require("express");
const indexer = require("../indexer");

const app = Router();
module.exports = app;

const agg = (obj) => indexer._client.search({
    index: indexer.mapping.index,
    size: 0,
    aggs: obj
}).then((res) => res.aggregations);

const tables = [];
function defineTable(name, cb){
    tables.push(name);
    app.get(`/${name}`, (req, res) => cb(req).then( (obj) => res.render("tables", {...obj, name}) ).catch(e => res.render("tables", {name, header: [], values: [], error: e})||console.log(e)));
    app.get(`/${name}.csv`, (req, res) => cb(req).then( (obj) => {
        let quote = (v) => typeof v === 'string' && parseFloat(v) != v ? `"${v}"` : v;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.write(obj.header.map(quote).join(";") + "\n");
        obj.values.forEach( (row) => res.write(row.map(quote).join(";") + "\n") );
        res.end();
    }).catch(e => res.render("tables", {header: [], values: [], error: e})||console.log(e)));
}

defineTable("ano-origem", ()=>agg({
    Ano: {
        date_histogram: {
            field: "Data",
            interval: "year",
            min_doc_count: 0,
            format: "yyyy"
        },
        aggs: {
            Origem: {
                terms: {
                    field: "Origem",
                    size: 15,
                    min_doc_count: 0
                }
            }
        }
    }
}).then(aggs => {
    let origens = aggs.Ano.buckets[0].Origem.buckets.map(bucket => bucket.key).sort((b1,b2) => b1.localeCompare(b2));
    let header = ["Ano\\Origem", "Total", ...origens];
    let values = aggs.Ano.buckets.map(b => [b.key_as_string, b.doc_count, ...(b.Origem.buckets.length > 0 ? b.Origem.buckets.sort((b1,b2) => b1.key.localeCompare(b2.key)) : origens.map(() => ({doc_count:0}))).map(b => b.doc_count)]);
    return {header, values};
}));

defineTable("ano-tribunal", ()=>agg({
    Ano: {
        date_histogram: {
            field: "Data",
            interval: "year",
            min_doc_count: 0,
            format: "yyyy"
        },
        aggs: {
            Tribunal: {
                terms: {
                    field: "Código Tribunal",
                    size: 15,
                    min_doc_count: 0
                }
            }
        }
    }
}).then(aggs => {
    let tribunais = aggs.Ano.buckets[0].Tribunal.buckets.map(bucket => bucket.key).sort((b1,b2) => b1.localeCompare(b2));
    let header = ["Ano\\Tribunal", "Total", ...tribunais];
    let values = aggs.Ano.buckets.map(b => [b.key_as_string, b.doc_count, ...(b.Tribunal.buckets.length > 0 ? b.Tribunal.buckets.sort((b1,b2) => b1.key.localeCompare(b2.key)) : tribunais.map(() => ({doc_count:0}))).map(b => b.doc_count)]);
    return {header, values};
}));

defineTable("ecli-errado", () => indexer._client.search({
    index: indexer.mapping.index,
    query: {
        bool: {
            must: [
                {
                    exists: {
                        field: "_UNMATCHING_ECLI"
                    }
                }
            ]
        }
    },
    size: 65535,
    track_total_hits: true,
    _source: ["ECLI", "_UNMATCHING_ECLI"]
}).then((res) => {
    const header = ["ECLI", "ECLI_ERRADO"];
    const values = res.hits.hits.map((hit) => [hit._source.ECLI, hit._source._UNMATCHING_ECLI]);
    return {header, values};
}));

const PARTITIONS = Math.ceil(317685 / 10000);

defineTable("ecli-repetido", (req)=>agg({
    ECLI: {
        terms: {
            field: "ECLI",
            include: {
                partition: req.query.p || 0,
                num_partitions: PARTITIONS
            },
            size: 317685,
            min_doc_count: 2
        },
        aggs: {
            Origem: {
                terms: {
                    field: "Origem",
                    size: 10
                }
            }
        }
    }
}).then(aggs => {
    let header = ["ECLI", "Total", "Origem"];
    let values = aggs.ECLI.buckets.map(b => [`<a href="../${b.key}">${b.key}</a>`, b.doc_count, b.Origem.buckets.map(b => b.key).join(", ")]);
    if( aggs.ECLI.sum_other_doc_count > 0 ){
        values.unshift([`<b>Outros ECLI não listados:</b> ${aggs.ECLI.sum_other_doc_count}</b>`, "", ""]);
    }
    let p = parseInt(req.query.p || "0");
    return {header, values, warning: `
        <p>A ver partição ${p+1} de ${PARTITIONS}.</p>
        <ul>Ir para:
            <li><a href="?p=0">Primeira partição</a></li>
            ${ p > 0  ? `<li><a href="?p=${p-1}">Partição anterior</a></li>` : "" }
            ${ p < 60  ? `<li><a href="?p=${p+1}">Partição Seguinte</a></li>` : "" }
            <li><a href="?p=${PARTITIONS-1}">Última partição</a></li>
        </ul>`};
}))

defineTable("entidades-ORG", ()=>indexer._client.search({
    index: "entities.1.0",
    size: 0,
    aggs: {
        Ents: {
          terms: {
            field: "entities.ORG.keyword",
            size: 59999
          }
        }
    },
    track_total_hits: true
}).then((res) => {
    const header = ["ORG", "DOCS"];
    const values = res.aggregations.Ents.buckets.map(b => [b.key, b.doc_count]);
    return {header, values};
}));

defineTable("entidades-PER", ()=>indexer._client.search({
    index: "entities.1.0",
    size: 0,
    aggs: {
        Ents: {
          terms: {
            field: "entities.PER.keyword",
            size: 59999
          }
        }
    },
    track_total_hits: true
}).then((res) => {
    const header = ["PER", "DOCS"];
    const values = res.aggregations.Ents.buckets.map(b => [b.key, b.doc_count]);
    return {header, values};
}));

defineTable("descritores-tribunal", (req)=>agg({
    Descritores: {
        terms: {
            field: "Descritores.keyword",
            include: {
                partition: req.query.p || 0,
                num_partitions: PARTITIONS
            },
            size: 317685
        },
        aggs: {
            Tribunal: {
                terms: {
                    field: "Tribunal",
                    size: 15,
                    min_doc_count: 0
                }
            }
        }
    }
}).then(aggs => {
    let tribunais = aggs.Descritores.buckets[0].Tribunal.buckets.map(bucket => bucket.key).sort((b1,b2) => b1.localeCompare(b2));
    let header = ["Descritor", "Total", ...tribunais];
    let values = aggs.Descritores.buckets.map(b => [b.key, b.doc_count, ...(b.Tribunal.buckets.length > 0 ? b.Tribunal.buckets.sort((b1,b2) => b1.key.localeCompare(b2.key)) : tribunais.map(() => ({doc_count:0}))).map(b => b.doc_count)]);
    

    let p = parseInt(req.query.p || "0");
    return {header, values, warning: `
        <p>A ver partição ${p+1} de ${PARTITIONS}.</p>
        <ul>Ir para:

            <li><a href="?p=0">Primeira partição</a></li>
            ${ p > 0  ? `<li><a href="?p=${p-1}">Partição anterior</a></li>` : "" }
            ${ p < 60  ? `<li><a href="?p=${p+1}">Partição Seguinte</a></li>` : "" }
            <li><a href="?p=${PARTITIONS-1}">Última partição</a></li>
        </ul>`};
}));


defineTable("votacao-tribunal", ()=>agg({
    Votação: {
        terms: {
            field: "Votação",
            size: 317685
        },
        aggs: {
            Tribunal: {
                terms: {
                    field: "Tribunal",
                    size: 15,
                    min_doc_count: 0
                }
            }
        }
    }
}).then(aggs => {
    let tribunais = aggs.Votação.buckets[0].Tribunal.buckets.map(bucket => bucket.key).sort((b1,b2) => b1.localeCompare(b2));
    let header = ["Votação", "Total", ...tribunais];
    let values = aggs.Votação.buckets.map(b => [b.key, b.doc_count, ...(b.Tribunal.buckets.length > 0 ? b.Tribunal.buckets.sort((b1,b2) => b1.key.localeCompare(b2.key)) : tribunais.map(() => ({doc_count:0}))).map(b => b.doc_count)]);
    
    return {header, values};
}));

defineTable("atributos-tribunal", async ()=>{
    let tribunais = await indexer._client.search({
        index: indexer.mapping.index,
        size: 0,
        aggs: {
            Tribunais: {
                terms: {
                    field: "Tribunal",
                    size: 150
                }
            }
        }
    }).then(r => r.aggregations);
    let attributes = Object.keys((await indexer._client.indices.getMapping({
        index: indexer.mapping.index
    }))[indexer.mapping.index].mappings.properties);

    let aggs = await indexer._client.search({
        size: 0,
        index: indexer.mapping.index,
        aggs: {
            Atributos: {
                filters: {
                    filters: attributes.reduce((obj, atr) => { 
                        obj[atr] = {
                            bool: {
                                must: {
                                    exists: {
                                        field: atr
                                    }
                                }
                            }
                        }
                        return obj; }, {})
                },
                aggs: {
                    Tribunal: {
                        terms: {
                            field: "Tribunal",
                            size: 15,
                            min_doc_count: 0
                        }
                    }
                }
            }
        }
    }).then(res => res.aggregations)
    
    let header = ["Atributo", "Total", ...tribunais.Tribunais.buckets.map(b => b.key).sort((b1,b2) => b1.localeCompare(b2))];
    let values = Object.keys(aggs.Atributos.buckets).map(atr => {
        let bucket = Object.entries(aggs.Atributos.buckets).find(([name, _]) => name === atr)[1];
        return [atr, bucket ? bucket.doc_count : 0, ...(bucket ? bucket.Tribunal.buckets.sort((b1,b2) => b1.key.localeCompare(b2.key)) : tribunais.Tribunais.buckets.map(() => ({doc_count:0}))).map(b => b.doc_count)];
    });

    return {header, values};
})



defineTable("meioprocessual-tribunal", ()=>agg({
    Meio: {
        terms: {
            field: "Meio Processual",
            size: 317685
        },
        aggs: {
            Tribunal: {
                terms: {
                    field: "Tribunal",
                    size: 15,
                    min_doc_count: 0
                }
            }
        }
    }
}).then(aggs => {
    let tribunais = aggs.Meio.buckets[0].Tribunal.buckets.map(bucket => bucket.key).sort((b1,b2) => b1.localeCompare(b2));
    let header = ["Meio Processual", "Total", ...tribunais];
    let values = aggs.Meio.buckets.map(b => [b.key, b.doc_count, ...(b.Tribunal.buckets.length > 0 ? b.Tribunal.buckets.sort((b1,b2) => b1.key.localeCompare(b2.key)) : tribunais.map(() => ({doc_count:0}))).map(b => b.doc_count)]);
    
    return {header, values};
}));

defineTable("seccao-tribunal", ()=>agg({
    Meio: {
        terms: {
            field: "Secção",
            size: 317685
        },
        aggs: {
            Tribunal: {
                terms: {
                    field: "Tribunal",
                    size: 15,
                    min_doc_count: 0
                }
            }
        }
    }
}).then(aggs => {
    let tribunais = aggs.Meio.buckets[0].Tribunal.buckets.map(bucket => bucket.key).sort((b1,b2) => b1.localeCompare(b2));
    let header = ["Secção", "Total", ...tribunais];
    let values = aggs.Meio.buckets.map(b => [b.key, b.doc_count, ...(b.Tribunal.buckets.length > 0 ? b.Tribunal.buckets.sort((b1,b2) => b1.key.localeCompare(b2.key)) : tribunais.map(() => ({doc_count:0}))).map(b => b.doc_count)]);
    
    return {header, values};
}));


defineTable("especie-tribunal", ()=>agg({
    Meio: {
        terms: {
            field: "Espécie",
            size: 317685
        },
        aggs: {
            Tribunal: {
                terms: {
                    field: "Tribunal",
                    size: 15,
                    min_doc_count: 0
                }
            }
        }
    }
}).then(aggs => {
    let tribunais = aggs.Meio.buckets[0].Tribunal.buckets.map(bucket => bucket.key).sort((b1,b2) => b1.localeCompare(b2));
    let header = ["Espécie", "Total", ...tribunais];
    let values = aggs.Meio.buckets.map(b => [b.key, b.doc_count, ...(b.Tribunal.buckets.length > 0 ? b.Tribunal.buckets.sort((b1,b2) => b1.key.localeCompare(b2.key)) : tribunais.map(() => ({doc_count:0}))).map(b => b.doc_count)]);
    
    return {header, values};
}));

app.get("/", (req, res) => res.render("tables", {header: ["Tabelas"], values: tables.map((t) => [`<a href="./${t}">${t}</a>`])}));
