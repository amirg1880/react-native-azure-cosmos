import { AzureToken, AzureQuieryHeader, AzureDocHeader } from './headers'
import { IResolverElement, Resolver } from './resolver'
import { cache } from 'react-native-fetch-cache/cacheResolver'


type RequestType =
    | 'Query'
    | 'Insert'
    | 'Update'
    | 'Sp'
    ;



interface AzureConfig {
    masterKey: string;
    version: string;
    dbUri: string;
    dbname: string;
}
interface AzureCosmosElementResolver extends IResolverElement<RequestType> {
    azurFetch(param: BaseFetchParam): Promise<Response>;
}

abstract class BaseAzureCosmosElementResolver<T extends BaseFetchParam> implements AzureCosmosElementResolver {

    abstract Key: RequestType;
    async azurFetch(param: BaseFetchParam): Promise<Response> {
        const isValid = (param.type === 'Query' || param.type === 'Sp') && cache(param.stateName, undefined)
        if (isValid) {
            return new Response(null, { status: 304, statusText: "cache" })
        }
        return this.azurFetchInner(param)

    }
    async abstract azurFetchInner(param: BaseFetchParam): Promise<Response>;
    public dbname(param: T): string {
        return param.dbname ? param.dbname : AzureCosmosLocator.config.dbname;
    }
    public uri(param: T): string {
        return `${AzureCosmosLocator.config.dbUri}dbs/${this.dbname(param)}/colls/${param.col}/docs`
    }
}


class AzureCosmosLocator extends Resolver<RequestType, AzureCosmosElementResolver> {
    static myInstance: AzureCosmosLocator = null;
    static config: AzureConfig;

    static getInstance() {
        if (AzureCosmosLocator.myInstance == null) {
            AzureCosmosLocator.myInstance = new AzureCosmosLocator();
        }

        return this.myInstance;
    }

    constructor() {
        super();
        super.Add(new AzureQuiry());
        super.Add(new AzureAddDocs());
        super.Add(new AzureUpdateDocs());
        super.Add(new AzureSp());

    }
}


export const initAzureCosmos = (config: AzureConfig) => {
    AzureCosmosLocator.config = config;
}

interface BaseFetchParam {
    dbname?: string,
    col: string,
    body: any,
    type: RequestType,
    partitionKey: string,
    stateName: string
}
interface UpdateFetchParam extends BaseFetchParam {
    id: string
}

interface SpFetchParam extends BaseFetchParam {
    spname: string
}


class AzureQuiry extends BaseAzureCosmosElementResolver<BaseFetchParam> {
    Key: RequestType = 'Query';
    constructor() {
        super()
    }
    async azurFetchInner(param: BaseFetchParam) {

        const uri = super.uri(param);
        const { auth, date } = AzureToken(uri, 'POST')
        const header = AzureQuieryHeader(auth, date, param.partitionKey);
        return fetch(uri, {
            method: 'POST',
            headers: header,
            body: JSON.stringify(param.body)
        })
    }
}


class AzureAddDocs extends BaseAzureCosmosElementResolver<BaseFetchParam> {
    Key: RequestType = 'Insert';
    constructor() {
        super()
    }
    async azurFetchInner(param: BaseFetchParam) {
        const uri = super.uri(param);
        const { auth, date } = AzureToken(uri, 'POST')
        const header = AzureDocHeader(auth, date, param.partitionKey);
        return await fetch(uri, {
            method: 'POST',
            headers: header,
            body: JSON.stringify(param.body)
        })
    }
}


class AzureSp extends BaseAzureCosmosElementResolver<SpFetchParam> {
    Key: RequestType = 'Sp';
    constructor() {
        super()
    }

    public uri(param: SpFetchParam): string {
        return `${AzureCosmosLocator.config.dbUri}dbs/${super.dbname(param)}/colls/${param.col}/sprocs/${param.spname}`
    }

    async azurFetchInner(param: SpFetchParam) {
        const uri = this.uri(param);
        const { auth, date } = AzureToken(uri, 'POST')
        const header = AzureDocHeader(auth, date, param.partitionKey);
        return await fetch(uri, {
            method: 'POST',
            headers: header,
            body: JSON.stringify(param.body)
        })
    }
}



class AzureUpdateDocs extends BaseAzureCosmosElementResolver<UpdateFetchParam> {
    Key: RequestType = 'Update';
    constructor() {
        super()
    }

    public uri(param: UpdateFetchParam): string {
        return `${AzureCosmosLocator.config.dbUri}dbs/${super.dbname(param)}/colls/${param.col}/docs/${param.id}`
    }

    async azurFetchInner(param: UpdateFetchParam) {
        const uri = this.uri(param);
        const { auth, date } = AzureToken(uri, 'PUT')
        const header = AzureDocHeader(auth, date, param.partitionKey);
        return await fetch(uri, {
            method: 'PUT',
            headers: header,
            body: JSON.stringify(param.body)
        })
    }
}



export const azurefetch = async (param: BaseFetchParam) => {
    let loctor = AzureCosmosLocator.getInstance();
    const reducer = loctor.Find(param.type);
    return reducer.azurFetch(param)
}
