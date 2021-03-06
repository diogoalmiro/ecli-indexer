/*
in https://jurisprudencia.csm.org.pt/ecli
Formato do Identificador
O ECLI consiste num identificador uniforme que tem o mesmo formato reconhecível para todos os Estados-Membros e tribunais da União Europeia.

O ECLI em Portugal consiste nos seguintes domínios:

«ECLI»;
O código do país: «PT»
O código do órgão jurisdicional: «STJ», «TRL», «TRP», «TRC», «TRE» ou «TRG» (actualmente o ECLI está disponível para identificação das decisões proferidas pelo Supremo Tribunal de Justiça e pelos Tribunais das Relações de Lisboa, Porto, Coimbra, Évora e Guimarães);
O ano da decisão;
Um número de série que, no caso português, tem por base o número de processo (acrescido, por vezes, dos caracteres identificadores apostos aquando da distribuição dos processos nos tribunais superiores.
Todos os componentes são separados por dois pontos. Um exemplo de um ECLI português:

ECLI : PT : TRC : 2017 : 198.15.3GCACB.C1

que corresponde a uma decisão proferida em Portugal, pelo Tribunal da Relação de Coimbra, em 2017, no processo 198.15.3GCACB
*/
//let matchEcli = (text) => text.match(/^ECLI:(?<country>PT):(?<court>[A-Z]{3}):(?<year>\d{4}):(?<number>([A-Z0-9]+\.?)+)$/); // strictier version of ECLI (3 letters court code), year with 4 numbers, and number cannot have dots in a row
let matchEcli = (text) => text.match(/^ECLI:(?<country>PT):(?<court>[A-Z]+):(?<year>\d+):(?<number>([A-Z0-9]*\.?)+)$/);
let validate = (ecli) => !!matchEcli(ecli);

module.exports = class ECLI{
    constructor(){
        this.country = ""
        this.jurisdiction = ""
        this.year = ""
        this.number = ""
    }
    setCountry(country){
        this.country = country
        return this
    }
    setJurisdiction(jurisdiction){
        this.jurisdiction = jurisdiction
        return this
    }
    setYear(year){
        this.year = year
        return this
    }
    setNumber(number){
        this.number = number.replace(/\W|_/g, ".").replace(/\.+/g, ".").replace(/^\./,"").replace(/\.$/,"").toUpperCase()
        return this
    }

    toString(){
        return `ECLI:${this.country}:${this.jurisdiction}:${this.year}:${this.number}`
    }
    
    build(){
        if( validate(this.toString()) ){
            return this.toString()
        }
        throw new Error("Invalid ECLI " + this.toString())
    }

    static fromString(ecli){
        let m = matchEcli(ecli)
        if( m ){
            return new ECLI().setCountry(m.groups.country).setJurisdiction(m.groups.court).setYear(m.groups.year).setNumber(m.groups.number);
        }
        throw new Error("Invalid ECLI " + ecli)
    }

    static fromObject(obj){
        return new ECLI().setCountry(obj.country).setJurisdiction(obj.jurisdiction).setYear(obj.year).setNumber(obj.number);
    }

    static validate(str){
        return validate(str)
    }

}